import assert from "node:assert/strict";
import { createHash, createHmac } from "node:crypto";
import test from "node:test";

import { parseListKeys, signRequest } from "./r2-s3.mjs";

const sha256Hex = (data) => createHash("sha256").update(data).digest("hex");
const hmac = (key, data) => createHmac("sha256", key).update(data).digest();

test("SigV4 signing matches the AWS S3 docs GET Object example", () => {
  const payloadHash = sha256Hex("");
  const auth = signRequest({
    method: "GET",
    url: new URL("https://examplebucket.s3.amazonaws.com/test.txt"),
    payloadHash,
    amzDate: "20130524T000000Z",
    accessKeyId: "AKIAIOSFODNN7EXAMPLE",
    secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
    region: "us-east-1",
    extraHeaders: [{ name: "range", value: "bytes=0-9" }],
  });
  const signature = auth.match(/Signature=([0-9a-f]{64})/)[1];
  assert.equal(signature, "f0e8bdb87c964420e857bd35b5d6ed310bd44f0170aba48dd91039c6036bdb41");
  assert.match(auth, /Credential=AKIAIOSFODNN7EXAMPLE\/20130524\/us-east-1\/s3\/aws4_request/);
  assert.match(auth, /SignedHeaders=host;range;x-amz-content-sha256;x-amz-date/);
});

test("canonical query params are sorted by name regardless of insertion order", () => {
  // Cloudflare R2 rejected an unsorted canonical query with
  // SignatureDoesNotMatch; its published canonical request pins the expected
  // hash for this exact GET, so signing the same request must reproduce it.
  const amzDate = "20260902T184337Z";
  const payloadHash = sha256Hex("");
  const key = "test-secret";
  const r2Canonical = [
    "GET",
    "/saijai-production-backups",
    "list-type=2&max-keys=1000&prefix=saijai-production%2F",
    "host:402d3c4bb385e06ab4359bc4584cc648.r2.cloudflarestorage.com",
    `x-amz-content-sha256:${payloadHash}`,
    `x-amz-date:${amzDate}`,
    "",
    "host;x-amz-content-sha256;x-amz-date",
    payloadHash,
  ].join("\n");
  const sts = [
    "AWS4-HMAC-SHA256",
    amzDate,
    "20260902/auto/s3/aws4_request",
    sha256Hex(r2Canonical),
  ].join("\n");
  const signingKey = hmac(hmac(hmac(hmac(`AWS4${key}`, "20260902"), "auto"), "s3"), "aws4_request");
  const expected = createHmac("sha256", signingKey).update(sts).digest("hex");

  const url = new URL(
    "https://402d3c4bb385e06ab4359bc4584cc648.r2.cloudflarestorage.com/saijai-production-backups",
  );
  // Insertion order deliberately differs from SigV4's required sorted order.
  for (const [name, value] of Object.entries({
    "list-type": "2",
    prefix: "saijai-production/",
    "max-keys": "1000",
  })) {
    url.searchParams.set(name, value);
  }
  const auth = signRequest({
    method: "GET",
    url,
    payloadHash,
    amzDate,
    accessKeyId: "AKIATEST",
    secretAccessKey: key,
  });
  assert.equal(auth.match(/Signature=([0-9a-f]{64})/)[1], expected);
});

test("parseListKeys returns only keys strictly older than the cutoff", () => {
  const xml = [
    `<ListBucketResult>`,
    `<Contents><Key>saijai-production/20260801T000000Z/a.dump.enc</Key><LastModified>2026-08-01T00:00:01.000Z</LastModified></Contents>`,
    `<Contents><Key>saijai-production/20260903T000000Z/b.dump.enc</Key><LastModified>2026-09-03T00:00:01.000Z</LastModified></Contents>`,
    `<Contents><Key>saijai-production/20260903T000000Z/b.summary.json</Key></Contents>`,
    `</ListBucketResult>`,
  ].join("");
  const keys = parseListKeys(xml, Date.parse("2026-09-02T00:00:00Z"));
  assert.deepEqual(keys, ["saijai-production/20260801T000000Z/a.dump.enc"]);
});
