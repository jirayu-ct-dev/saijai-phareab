// PRN-04 per-printer mutex: only one send loop may be active per printerId.

import { describe, expect, it } from "vitest";
import path from "node:path";
import { Outbox } from "../../print-bridge/outbox.mjs";
import { PrinterMutex } from "../../print-bridge/mutex.mjs";
import { createJobRunner } from "../../print-bridge/runner.mjs";
import {
  SILENT_LOG,
  createFakeApi,
  encodeFakeOperations,
  withTempDir,
} from "./printBridgeTestHelpers";

describe("print bridge per-printer mutex", () => {
  it("rejects a second run loop for the same printer while one is active", async () => {
    await withTempDir(async (dir) => {
      const outbox = new Outbox(path.join(dir, "outbox.jsonl"));
      const mutex = new PrinterMutex();
      const { api } = createFakeApi({ claimDelayMs: 20 });
      const runner = createJobRunner({
        printerId: "printer-1",
        api,
        encodeOperations: encodeFakeOperations,
        createTransport: () => {
          throw new Error("no transport expected");
        },
        outbox,
        mutex,
        log: SILENT_LOG,
      });

      const first = runner.runOnce();
      await expect(runner.runOnce()).rejects.toThrow(/busy.*send loop/i);
      await expect(first).resolves.toMatchObject({ claimed: 0 });
      await outbox.close();
    });
  });

  it("allows the next run loop after the previous one released the printer", async () => {
    await withTempDir(async (dir) => {
      const outbox = new Outbox(path.join(dir, "outbox.jsonl"));
      const mutex = new PrinterMutex();
      const { api } = createFakeApi();
      const runner = createJobRunner({
        printerId: "printer-1",
        api,
        encodeOperations: encodeFakeOperations,
        createTransport: () => {
          throw new Error("no transport expected");
        },
        outbox,
        mutex,
        log: SILENT_LOG,
      });

      await runner.runOnce();
      await expect(runner.runOnce()).resolves.toMatchObject({ claimed: 0 });
      await outbox.close();
    });
  });

  it("tracks locks per printerId, so a different printer can run concurrently", () => {
    const mutex = new PrinterMutex();
    const releaseA = mutex.acquire("printer-a");
    expect(mutex.isLocked("printer-a")).toBe(true);
    expect(mutex.isLocked("printer-b")).toBe(false);
    const releaseB = mutex.acquire("printer-b");
    expect(() => mutex.acquire("printer-a")).toThrow(/busy/);
    releaseA();
    expect(() => mutex.acquire("printer-a")).not.toThrow();
    releaseB();
  });
});
