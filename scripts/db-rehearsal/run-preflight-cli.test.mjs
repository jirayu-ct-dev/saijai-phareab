import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import test from "node:test";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const runner = join(scriptDir, "run-preflight.mjs");

function run(args, extraEnv = {}) {
  return spawnSync(process.execPath, [runner, ...args], {
    encoding: "utf8",
    env: {
      ...process.env,
      DATABASE_URL: "",
      ...extraEnv,
    },
  });
}

test("refuses to run without an explicit target confirmation", () => {
  const result = run([]);

  assert.equal(result.status, 64);
  assert.match(result.stderr, /explicit target confirmation/);
});

test("refuses ambiguous disposable and production confirmations", () => {
  const result = run([
    "--confirm-disposable",
    "--confirm-production-read-only",
    "--approval-reference",
    "chat-approval-b",
    "--report-file",
    "/tmp/approval-b.json",
  ]);

  assert.equal(result.status, 64);
  assert.match(result.stderr, /exactly one target confirmation/);
});

test("production read-only mode requires a sanitized approval reference", () => {
  const missing = run([
    "--confirm-production-read-only",
    "--report-file",
    "/tmp/approval-b.json",
  ]);
  const unsafe = run([
    "--confirm-production-read-only",
    "--approval-reference",
    "contains spaces and secrets",
    "--report-file",
    "/tmp/approval-b.json",
  ]);

  assert.equal(missing.status, 64);
  assert.match(missing.stderr, /approval-reference/);
  assert.equal(unsafe.status, 64);
  assert.match(unsafe.stderr, /approval-reference/);
});

test("production read-only mode requires an absolute report path", () => {
  const missing = run([
    "--confirm-production-read-only",
    "--approval-reference",
    "chat-approval-b",
  ]);
  const relative = run([
    "--confirm-production-read-only",
    "--approval-reference",
    "chat-approval-b",
    "--report-file",
    "approval-b.json",
  ]);

  assert.equal(missing.status, 64);
  assert.match(missing.stderr, /absolute --report-file/);
  assert.equal(relative.status, 64);
  assert.match(relative.stderr, /absolute --report-file/);
});

test("production read-only mode refuses a report path inside the repository", () => {
  const result = run([
    "--confirm-production-read-only",
    "--approval-reference",
    "chat-approval-b",
    "--report-file",
    join(scriptDir, "approval-b.json"),
  ]);

  assert.equal(result.status, 64);
  assert.match(result.stderr, /outside the repository/);
});

test("valid production authorization reaches environment validation without a database URL", () => {
  const result = run([
    "--confirm-production-read-only",
    "--approval-reference",
    "chat-2026-09-02-g3-b",
    "--report-file",
    "/tmp/approval-b.json",
  ]);

  assert.equal(result.status, 64);
  assert.match(result.stderr, /DATABASE_URL is not set/);
  assert.doesNotMatch(result.stdout, /postgres(?:ql)?:\/\//);
});

test("production mode refuses a database connection without an explicit CA file", () => {
  const result = run(
    [
      "--confirm-production-read-only",
      "--approval-reference",
      "chat-2026-09-02-g3-b",
      "--report-file",
      "/tmp/approval-b-no-ca.json",
    ],
    { DATABASE_URL: "postgresql://user:password@127.0.0.1:1/database" },
  );

  assert.equal(result.status, 64);
  assert.match(result.stderr, /PREFLIGHT_SSL_ROOT_CERT/);
});

test("production connection failures do not reveal target or credential details", () => {
  const evidenceDir = mkdtempSync(join(tmpdir(), "saijai-preflight-cli-test-"));
  try {
    const caPath = join(evidenceDir, "test-ca.pem");
    writeFileSync(
      caPath,
      "-----BEGIN CERTIFICATE-----\nsynthetic-test-only-certificate-material\n-----END CERTIFICATE-----\n",
    );
    const result = run(
      [
        "--confirm-production-read-only",
        "--approval-reference",
        "chat-2026-09-02-g3-b",
        "--report-file",
        join(evidenceDir, "approval-b-unreachable.json"),
      ],
      {
        DATABASE_URL:
          "postgresql://sensitive_user:sensitive_password@127.0.0.1:1/sensitive_database",
        PREFLIGHT_SSL_ROOT_CERT: caPath,
      },
    );
    const output = `${result.stdout}\n${result.stderr}`;

    assert.equal(result.status, 1);
    assert.doesNotMatch(output, /sensitive_user|sensitive_password|sensitive_database/);
    assert.doesNotMatch(output, /postgres(?:ql)?:\/\//);
    assert.match(output, /"errorCode":"ECONNREFUSED"/);
  } finally {
    rmSync(evidenceDir, { recursive: true, force: true });
  }
});
