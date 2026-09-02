// PRN-04 restart recovery: outbox records "bytes written but SENT not
// reported" must produce a NEEDS_REVIEW report on the next start — never SENT,
// never a silent retry.

import { describe, expect, it } from "vitest";
import path from "node:path";
import { Outbox } from "../../print-bridge/outbox.mjs";
import { PrinterMutex } from "../../print-bridge/mutex.mjs";
import { createJobRunner } from "../../print-bridge/runner.mjs";
import {
  SILENT_LOG,
  createFakeApi,
  encodeFakeOperations,
  makeJob,
  withTempDir,
} from "./printBridgeTestHelpers";

function baseRecord(outboxJobId: string, extra: Record<string, unknown> = {}) {
  return {
    jobId: outboxJobId,
    attempts: 1,
    state: "SENDING",
    leaseToken: "lease-1",
    fencingToken: 7,
    lastEventAt: new Date().toISOString(),
    bytesWritten: true,
    sentReported: false,
    nextAttemptAt: null,
    ...extra,
  };
}

function createRunner(api: unknown, outbox: Outbox) {
  return createJobRunner({
    printerId: "printer-1",
    api,
    encodeOperations: encodeFakeOperations,
    createTransport: () => {
      throw new Error("no transport expected during recovery");
    },
    outbox,
    mutex: new PrinterMutex(),
    maxAttempts: 3,
    retryBackoffMs: 0,
    log: SILENT_LOG,
  });
}

describe("print bridge restart recovery", () => {
  it("reports NEEDS_REVIEW (not SENT) for bytes-written-without-SENT records", async () => {
    await withTempDir(async (dir) => {
      const outboxPath = path.join(dir, "outbox.jsonl");
      const outbox = new Outbox(outboxPath);
      await outbox.append(baseRecord("job-1"));

      const { api, state } = createFakeApi();
      const runner = createRunner(api, outbox);

      await runner.recover();

      expect(state.events).toHaveLength(1);
      expect(state.events[0]).toMatchObject({
        jobId: "job-1",
        type: "NEEDS_REVIEW",
        leaseToken: "lease-1",
        fencingToken: 7,
      });
      expect(state.events.some((event) => event.type === "SENT")).toBe(false);

      const latest = await outbox.latestByJob();
      expect(latest.get("job-1")?.state).toBe("NEEDS_REVIEW_REPORTED");
      expect(latest.get("job-1")?.sentReported).toBe(true);
    });
  });

  it("keeps mid-pipeline records without bytes as RETRY_WAIT and reports nothing", async () => {
    await withTempDir(async (dir) => {
      const outboxPath = path.join(dir, "outbox.jsonl");
      const outbox = new Outbox(outboxPath);
      await outbox.append(baseRecord("job-1", { state: "PROCESSING", bytesWritten: false }));
      await outbox.append(
        baseRecord("job-2", { state: "SENT_REPORTED", sentReported: true }),
      );

      const { api, state } = createFakeApi();
      const runner = createRunner(api, outbox);
      await runner.recover();

      expect(state.events).toHaveLength(0);
      const latest = await outbox.latestByJob();
      expect(latest.get("job-1")?.state).toBe("RETRY_WAIT");
      expect(latest.get("job-1")?.attempts).toBe(1); // attempts survive restarts
      expect(latest.get("job-2")?.state).toBe("SENT_REPORTED");
    });
  });

  it("reports NEEDS_REVIEW during the next runOnce cycle after a crash between write and report", async () => {
    await withTempDir(async (dir) => {
      const outboxPath = path.join(dir, "outbox.jsonl");
      // Pre-seed the outbox exactly as a crash would have left it.
      const crashedOutbox = new Outbox(outboxPath);
      await crashedOutbox.append(baseRecord("job-1"));

      const { api, state } = createFakeApi();
      // The server no longer considers this job claimable, but the recovery
      // must still reconcile it from the outbox alone.
      const runner = createRunner(api, crashedOutbox);
      await runner.runOnce();

      const reviewEvents = state.events.filter((event) => event.type === "NEEDS_REVIEW");
      expect(reviewEvents).toHaveLength(1);
      expect(reviewEvents[0]).toMatchObject({ jobId: "job-1", fencingToken: 7 });
      expect(state.events.some((event) => event.type === "SENT")).toBe(false);
    });
  });
});
