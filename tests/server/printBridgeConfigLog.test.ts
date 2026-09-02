// PRN-04 config loader validation + credential redaction guarantees.

import { describe, expect, it } from "vitest";
import { writeFile, chmod } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { loadConfig, validateConfig } from "../../print-bridge/config.mjs";
import { createRedactingLogger } from "../../print-bridge/log.mjs";
import { createApiClient, ApiError } from "../../print-bridge/apiClient.mjs";

const CREDENTIAL = "bridge-secret-token-abc123";

const VALID_CONFIG = {
  baseUrl: "http://localhost:3000",
  printerId: "printer-1",
  bridgeCredential: CREDENTIAL,
  pollIntervalMs: 15000,
  outboxPath: "./outbox.jsonl",
  tcpTarget: { host: "192.168.1.50", port: 9100 },
};

// Mode bits are meaningless on Windows and not enforced for root.
const canTestFileModes =
  process.platform !== "win32" &&
  (typeof process.getuid !== "function" || process.getuid() !== 0);

async function makeConfigDir() {
  const dir = await import("node:fs/promises").then((fs) =>
    fs.mkdtemp(path.join(os.tmpdir(), "print-bridge-config-")),
  );
  return dir;
}

describe("print bridge config loader", () => {
  it("validates required fields and applies defaults", () => {
    const config = validateConfig(VALID_CONFIG);
    expect(config).toMatchObject({
      baseUrl: "http://localhost:3000",
      printerId: "printer-1",
      pollIntervalMs: 15000,
      tcpTarget: { host: "192.168.1.50", port: 9100 },
    });

    expect(() => validateConfig({ ...VALID_CONFIG, printerId: "" })).toThrow(/printerId/);
    expect(() => validateConfig({ ...VALID_CONFIG, bridgeCredential: "" })).toThrow(
      /bridgeCredential/,
    );
    expect(() => validateConfig({ ...VALID_CONFIG, baseUrl: "not-a-url" })).toThrow(/baseUrl/);
    expect(() => validateConfig({ ...VALID_CONFIG, baseUrl: "ftp://x" })).toThrow(/baseUrl/);
    expect(() => validateConfig({ ...VALID_CONFIG, pollIntervalMs: -1 })).toThrow(/pollIntervalMs/);
    expect(() => validateConfig({ ...VALID_CONFIG, tcpTarget: { host: "h", port: 0 } })).toThrow(
      /port/,
    );
    expect(() => validateConfig({ ...VALID_CONFIG, tcpTarget: null })).toThrow(/tcpTarget/);
  });

  it("loads a 0600 config file and rejects a group/world readable one", async () => {
    const dir = await makeConfigDir();
    try {
      const configPath = path.join(dir, "config.json");
      await writeFile(configPath, JSON.stringify(VALID_CONFIG), { mode: 0o600 });
      await chmod(configPath, 0o600);
      const loaded = await loadConfig(configPath);
      expect(loaded.printerId).toBe("printer-1");

      if (!canTestFileModes) {
        return;
      }
      await chmod(configPath, 0o644);
      await expect(loadConfig(configPath)).rejects.toThrow(/chmod 600/);
    } finally {
      await import("node:fs/promises").then((fs) => fs.rm(dir, { recursive: true, force: true }));
    }
  });

  it("fails with a clear error when the config file is missing", async () => {
    const dir = await makeConfigDir();
    try {
      await expect(loadConfig(path.join(dir, "missing.json"))).rejects.toThrow(
        /config file not found/i,
      );
    } finally {
      await import("node:fs/promises").then((fs) => fs.rm(dir, { recursive: true, force: true }));
    }
  });
});

describe("print bridge credential redaction", () => {
  it("never writes the credential to log lines, even when embedded in messages", () => {
    const lines: string[] = [];
    const log = createRedactingLogger({ credential: CREDENTIAL, write: (line) => lines.push(line) });

    log.info(`bridge starting (credential ${CREDENTIAL})`);
    log.warn(`heartbeat failed near ${CREDENTIAL}`, `detail contains ${CREDENTIAL} too`);
    log.error(new Error(`unexpected with ${CREDENTIAL}`).message);

    const output = lines.join("");
    expect(output).toContain("[REDACTED]");
    expect(output).not.toContain(CREDENTIAL);
    // Regex guard: the raw token never appears anywhere in the output.
    expect(new RegExp(CREDENTIAL).test(output)).toBe(false);
  });

  it("sends the credential only in the Authorization header, never in a body", async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const fetchImpl = async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return {
        ok: true,
        status: 200,
        json: async () => ({ ok: true, serverTime: new Date().toISOString() }),
      };
    };
    const api = createApiClient({
      baseUrl: "http://localhost:3000",
      bridgeCredential: CREDENTIAL,
      printerId: "printer-1",
      fetchImpl,
    });

    await api.heartbeat("0.1.0");
    await api.claim(5);

    expect(calls).toHaveLength(2);
    for (const call of calls) {
      expect((call.init.headers as Record<string, string>).authorization).toBe(
        `Bearer ${CREDENTIAL}`,
      );
      expect(String(call.init.body)).not.toContain(CREDENTIAL);
      expect(call.url).toContain("/api/admin/print-bridge/");
    }
  });

  it("error messages from failed API calls never contain the credential", async () => {
    const fetchImpl = async () => ({ ok: false, status: 500, json: async () => ({}) });
    const api = createApiClient({
      baseUrl: "http://localhost:3000",
      bridgeCredential: CREDENTIAL,
      printerId: "printer-1",
      fetchImpl,
    });

    const error = await api.claim(5).catch((err: unknown) => err);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).message).toContain("500");
    expect((error as ApiError).message).not.toContain(CREDENTIAL);
  });

  it("network-level failures surface a safe message without provider internals", async () => {
    const fetchImpl = async () => {
      throw new Error(`fetch failed (token was ${CREDENTIAL})`);
    };
    const api = createApiClient({
      baseUrl: "http://localhost:3000",
      bridgeCredential: CREDENTIAL,
      printerId: "printer-1",
      fetchImpl,
    });

    const error = await api.heartbeat("0.1.0").catch((err: unknown) => err);
    expect((error as Error).message).not.toContain(CREDENTIAL);
    expect((error as Error).message).toContain("network error");
  });
});
