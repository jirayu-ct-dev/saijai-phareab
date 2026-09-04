import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createFileStateStore } from "../../print-bridge/state.mjs";

const directories: string[] = [];
afterEach(async () => Promise.all(directories.splice(0).map(directory => rm(directory, { recursive: true, force: true }))));

describe("LAN Print Gateway state", () => {
  it("writes versioned state atomically with owner-only permissions", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "saijai-gateway-"));
    directories.push(directory);
    const statePath = path.join(directory, "state.json");
    const store = createFileStateStore(statePath);
    const next = { version: 2, printers: [{ id: "printer_one", name: "หน้าเคาน์เตอร์", host: "192.168.1.10", port: 9100 }] };
    await store.write(next);
    expect(await store.read()).toEqual(next);
    expect((await stat(statePath)).mode & 0o077).toBe(0);
    expect(await readFile(statePath, "utf8")).not.toContain("receipt");
  });

  it("migrates legacy paired state without retaining token hashes", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "saijai-gateway-"));
    directories.push(directory);
    const statePath = path.join(directory, "state.json");
    await writeFile(statePath, JSON.stringify({
      version: 1,
      tokens: [{ hash: "legacy-secret-hash", expiresAt: "2099-01-01T00:00:00.000Z" }],
      printers: [{ id: "printer_one", name: "หน้าเคาน์เตอร์", host: "192.168.1.10", port: 9100 }],
    }), { mode: 0o600 });
    const store = createFileStateStore(statePath);

    expect(await store.read()).toEqual({
      version: 2,
      printers: [{ id: "printer_one", name: "หน้าเคาน์เตอร์", host: "192.168.1.10", port: 9100 }],
    });
    expect(await readFile(statePath, "utf8")).not.toContain("legacy-secret-hash");
  });
});
