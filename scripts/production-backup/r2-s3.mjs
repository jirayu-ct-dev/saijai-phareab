#!/usr/bin/env node
// Minimal S3-compatible client for Cloudflare R2 using AWS SigV4 and no
// dependencies. Supports exactly what scripts/production-backup/r2-backup.sh
// needs: putObject, listObjectsV2 (filtered by cutoff) and deleteObject.
// Credentials come from R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY (R2 API token
// pair); they are never printed.
//
//   node r2-s3.mjs put      --endpoint URL --bucket B --key K --file F
//   node r2-s3.mjs get      --endpoint URL --bucket B --key K --file F
//   node r2-s3.mjs list-old --endpoint URL --bucket B --prefix P --cutoff ISO
//   node r2-s3.mjs delete   --endpoint URL --bucket B --key K

import { createHash, createHmac } from "node:crypto";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const SERVICE = "s3";
const REGION = "auto";

function argValue(args, flag) {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
}

function sha256Hex(data) {
  return createHash("sha256").update(data).digest("hex");
}

function hmac(key, data) {
  return createHmac("sha256", key).update(data).digest();
}

function usage() {
    console.error(
      "usage: r2-s3.mjs put|get|list-old|delete --endpoint URL --bucket B [--key K] [--file F] [--prefix P] [--cutoff ISO]",
    );
  process.exit(64);
}

function credentials() {
  const accessKeyId = process.env.R2_ACCESS_KEY_ID ?? process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey =
    process.env.R2_SECRET_ACCESS_KEY ?? process.env.AWS_SECRET_ACCESS_KEY;
  if (!accessKeyId || !secretAccessKey) {
    console.error("R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY are required");
    process.exit(64);
  }
  return { accessKeyId, secretAccessKey };
}

// Pure SigV4 signing so the AWS official test suite vector can verify it.
export function signRequest({
  method,
  url,
  payloadHash,
  amzDate,
  accessKeyId,
  secretAccessKey,
  region = REGION,
  extraHeaders = [],
}) {
  const dateStamp = amzDate.slice(0, 8);

  const headers = [
    { name: "host", value: url.host },
    { name: "x-amz-content-sha256", value: payloadHash },
    { name: "x-amz-date", value: amzDate },
    ...extraHeaders,
  ].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  const canonicalHeaders = headers.map((h) => `${h.name}:${h.value}\n`).join("");
  const signedHeaders = headers.map((h) => h.name).join(";");
  const canonicalRequest = [
    method,
    url.pathname,
    // SigV4 canonical query params must be sorted by name and RFC3986-encoded.
    [...url.searchParams.entries()]
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(
        ([name, value]) =>
          `${encodeURIComponent(name)}=${encodeURIComponent(value).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)}`,
      )
      .join("&"),
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");

  const scope = `${dateStamp}/${region}/${SERVICE}/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    scope,
    sha256Hex(canonicalRequest),
  ].join("\n");

  const signingKey = hmac(
    hmac(hmac(hmac(`AWS4${secretAccessKey}`, dateStamp), region), SERVICE),
    "aws4_request",
  );
  const signature = createHmac("sha256", signingKey).update(stringToSign).digest("hex");

  return (
    `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${scope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`
  );
}

async function s3Request({ method, endpoint, bucket, key = "", query = {}, body = null }) {
  const { accessKeyId, secretAccessKey } = credentials();
  const url = new URL(endpoint.replace(/\/+$/, "") + "/" + bucket);
  if (key) url.pathname += "/" + key.split("/").map(encodeURIComponent).join("/");
  for (const [name, value] of Object.entries(query)) url.searchParams.set(name, value);

  const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, "");
  const payloadHash = sha256Hex(body ?? "");

  const authorization = signRequest({ method, url, payloadHash, amzDate, accessKeyId, secretAccessKey });

  let response;
  try {
    response = await fetch(url, {
      method,
      headers: {
        Authorization: authorization,
        "x-amz-content-sha256": payloadHash,
        "x-amz-date": amzDate,
      },
      body,
    });
  } catch (error) {
    console.error(`request to ${url.host} failed: ${error?.cause?.code ?? error?.code ?? error}`);
    process.exit(1);
  }
  return response;
}

// Pure helper: keys from a ListBucketResult XML strictly older than cutoffMs.
export function parseListKeys(xml, cutoffMs) {
  const keys = [];
  for (const match of xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)) {
    const contents = match[1];
    const key = contents.match(/<Key>([^<]+)<\/Key>/)?.[1];
    const modified = contents.match(/<LastModified>([^<]+)<\/LastModified>/)?.[1];
    const modifiedMs = modified ? Date.parse(modified) : Number.NaN;
    if (key && Number.isFinite(modifiedMs) && modifiedMs < cutoffMs) keys.push(key);
  }
  return keys;
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const endpoint = argValue(args, "--endpoint");
  const bucket = argValue(args, "--bucket");
  if (!command || !endpoint || !bucket) usage();

  if (command === "put") {
    const key = argValue(args, "--key");
    const file = argValue(args, "--file");
    if (!key || !file) usage();
    const body = await readFile(file);
    const response = await s3Request({ method: "PUT", endpoint, bucket, key, body });
    if (!response.ok) {
      console.error(`put failed: ${response.status} ${await response.text()}`);
      process.exit(1);
    }
    console.log(`uploaded s3://${bucket}/${key}`);
  } else if (command === "get") {
    const key = argValue(args, "--key");
    const file = argValue(args, "--file");
    if (!key || !file) usage();
    const response = await s3Request({ method: "GET", endpoint, bucket, key });
    if (!response.ok) {
      console.error(`get failed: ${response.status} ${await response.text()}`);
      process.exit(1);
    }
    const { writeFile } = await import("node:fs/promises");
    await writeFile(file, Buffer.from(await response.arrayBuffer()), { mode: 0o600 });
    console.log(`downloaded s3://${bucket}/${key} -> ${file}`);
  } else if (command === "list-old") {
    const prefix = argValue(args, "--prefix");
    const cutoff = argValue(args, "--cutoff");
    if (!prefix || !cutoff) usage();
    const response = await s3Request({
      method: "GET",
      endpoint,
      bucket,
      query: { "list-type": "2", prefix, "max-keys": "1000" },
    });
    if (!response.ok) {
      console.error(`list failed: ${response.status} ${await response.text()}`);
      process.exit(1);
    }
    const xml = await response.text();
    const cutoffMs = Date.parse(cutoff);
    if (!Number.isFinite(cutoffMs)) {
      console.error("cutoff must be an ISO-8601 timestamp");
      process.exit(64);
    }
    for (const key of parseListKeys(xml, cutoffMs)) console.log(key);
  } else if (command === "delete") {
    const key = argValue(args, "--key");
    if (!key) usage();
    const response = await s3Request({ method: "DELETE", endpoint, bucket, key });
    if (!response.ok && response.status !== 404) {
      console.error(`delete failed: ${response.status} ${await response.text()}`);
      process.exit(1);
    }
    console.log(`deleted s3://${bucket}/${key}`);
  } else {
    usage();
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  await main();
}
