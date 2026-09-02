// PRN-04 job runner: event sequence, C8 failure classification, bounded local
// retry, stale-fencing drop and lease handling.

import { describe, expect, it } from "vitest";
import path from "node:path";
import { Outbox } from "../../print-bridge/outbox.mjs";
import { PrinterMutex } from "../../print-bridge/mutex.mjs";
import { createJobRunner } from "../../print-bridge/runner.mjs";
import { FakeTransport } from "../../print-bridge/transport/fake.js";
import {
  SILENT_LOG,
  createFakeApi,
  encodeFakeOperations,
  makeJob,
  withTempDir,
  type FakeClaimJob,
} from "./printBridgeTestHelpers";

type RunnerOverrides = {
  maxAttempts?: number;
  retryBackoffMs?: number;
  createTransport?: (job: FakeClaimJob) => unknown;
};

function createRunner(api: unknown, outbox: Outbox, overrides: RunnerOverrides = {}) {
  return createJobRunner({
    printerId: "printer-1",
    api,
    encodeOperations: encodeFakeOperations,
    createTransport:
      overrides.createTransport ?? (() => new FakeTransport({ success: true })),
    outbox,
    mutex: new PrinterMutex(),
    maxAttempts: overrides.maxAttempts ?? 3,
    retryBackoffMs: overrides.retryBackoffMs ?? 0,
    log: SILENT_LOG,
  });
}

function eventTypeSequence(events: Array<Record<string, unknown>>): string[] {
  return events.map((event) => String(event.type));
}

describe("print bridge job runner", () => {
  it("success path reports RENDERING -> READY -> SENDING -> SENT and records SENT_REPORTED", async () => {
    await withTempDir(async (dir) => {
      const outbox = new Outbox(path.join(dir, "outbox.jsonl"));
      const { api, state } = createFakeApi();
      state.claimQueue.push(makeJob());
      const transport = new FakeTransport();
      const runner = createRunner(api, outbox, { createTransport: () => transport });

      await runner.runOnce();

      expect(eventTypeSequence(state.events)).toEqual(["RENDERING", "READY", "SENDING", "SENT"]);
      const firstEvent = state.events[0] ?? {};
      expect(firstEvent).toMatchObject({ jobId: "job-1", leaseToken: "lease-1", fencingToken: 7 });
      expect(Array.from(transport.chunks[0] ?? new Uint8Array())).toEqual(
        Array.from(encodeFakeOperations([])),
      );
      const latest = await outbox.latestByJob();
      expect(latest.get("job-1")).toMatchObject({
        state: "SENT_REPORTED",
        bytesWritten: true,
        sentReported: true,
      });
      await outbox.close();
    });
  });

  it("writeFailAfterBytes (partial write) reports NEEDS_REVIEW and never retries", async () => {
    await withTempDir(async (dir) => {
      const outbox = new Outbox(path.join(dir, "outbox.jsonl"));
      const { api, state } = createFakeApi();
      state.claimQueue.push(makeJob());
      const runner = createRunner(api, outbox, {
        createTransport: () => new FakeTransport({ writeFailAfterBytes: 3 }),
      });

      await runner.runOnce();

      expect(eventTypeSequence(state.events)).toEqual(["RENDERING", "READY", "SENDING", "NEEDS_REVIEW"]);
      expect(state.events.some((event) => event.type === "FAILED")).toBe(false);
      const latest = await outbox.latestByJob();
      expect(latest.get("job-1")).toMatchObject({
        state: "NEEDS_REVIEW_REPORTED",
        bytesWritten: true,
      });
      // A second cycle must not retry the job.
      await runner.runOnce();
      expect(eventTypeSequence(state.events)).toEqual(["RENDERING", "READY", "SENDING", "NEEDS_REVIEW"]);
      await outbox.close();
    });
  });

  it("connectFail before bytes reports FAILED_OFFLINE, re-queues with backoff, NEEDS_REVIEW after max attempts", async () => {
    await withTempDir(async (dir) => {
      const outbox = new Outbox(path.join(dir, "outbox.jsonl"));
      const { api, state } = createFakeApi();
      state.claimQueue.push(makeJob());
      const runner = createRunner(api, outbox, {
        createTransport: () => new FakeTransport({ connectFail: true }),
        maxAttempts: 3,
        retryBackoffMs: 1000,
      });

      // Attempt 1: FAILED_OFFLINE + local RETRY_WAIT with backoff due date.
      await runner.runOnce();
      expect(eventTypeSequence(state.events)).toEqual(["RENDERING", "READY", "FAILED"]);
      expect(state.events[2]).toMatchObject({ failureCode: "FAILED_OFFLINE" });
      let latest = await outbox.latestByJob();
      const afterFirst = latest.get("job-1");
      expect(afterFirst).toMatchObject({ state: "RETRY_WAIT", attempts: 1 });
      expect(afterFirst?.nextAttemptAt).not.toBeNull();

      // Attempt 2: still under the cap -> FAILED again, attempts=2.
      await runner.runOnce();
      latest = await outbox.latestByJob();
      expect(latest.get("job-1")).toMatchObject({ state: "RETRY_WAIT", attempts: 2 });

      // Attempt 3: cap reached -> NEEDS_REVIEW, stop retrying.
      await runner.runOnce();
      expect(eventTypeSequence(state.events)).toEqual([
        "RENDERING",
        "READY",
        "FAILED",
        "RENDERING",
        "READY",
        "FAILED",
        "RENDERING",
        "READY",
        "NEEDS_REVIEW",
      ]);
      latest = await outbox.latestByJob();
      expect(latest.get("job-1")?.state).toBe("NEEDS_REVIEW_REPORTED");

      // No further processing once reviewed.
      await runner.runOnce();
      expect(state.events).toHaveLength(9);
      await outbox.close();
    });
  });

  it("stale-fencing rejection drops the job locally with no retry", async () => {
    await withTempDir(async (dir) => {
      const outbox = new Outbox(path.join(dir, "outbox.jsonl"));
      const { api, state } = createFakeApi();
      state.claimQueue.push(makeJob());
      state.eventResultOverrides.push({
        match: (event) => event.type === "RENDERING",
        result: { accepted: false, reason: "stale-fencing" },
      });
      const runner = createRunner(api, outbox);

      await runner.runOnce();

      expect(eventTypeSequence(state.events)).toEqual(["RENDERING"]);
      const latest = await outbox.latestByJob();
      expect(latest.get("job-1")?.state).toBe("DROPPED");

      // The server may still return the job; it must not be processed again.
      await runner.runOnce();
      expect(state.events).toHaveLength(1);
      await outbox.close();
    });
  });

  it("a job claimed with an expired lease is skipped without events", async () => {
    await withTempDir(async (dir) => {
      const outbox = new Outbox(path.join(dir, "outbox.jsonl"));
      const { api, state } = createFakeApi();
      state.claimQueue.push(
        makeJob({ leaseExpiresAt: new Date(Date.now() - 1000).toISOString() }),
      );
      const runner = createRunner(api, outbox);

      await runner.runOnce();

      expect(state.events).toHaveLength(0);
      expect((await outbox.latestByJob()).size).toBe(0);
      await outbox.close();
    });
  });

  it("bytes written but SENT report lost (network error) parks the job for NEEDS_REVIEW recovery", async () => {
    await withTempDir(async (dir) => {
      const outbox = new Outbox(path.join(dir, "outbox.jsonl"));
      const { api, state } = createFakeApi();
      state.claimQueue.push(makeJob());
      state.eventThrowFor = (event) => event.type === "SENT";
      const runner = createRunner(api, outbox);

      await runner.runOnce();

      expect(eventTypeSequence(state.events)).toEqual(["RENDERING", "READY", "SENDING"]);
      let latest = await outbox.latestByJob();
      expect(latest.get("job-1")).toMatchObject({
        state: "SENDING",
        bytesWritten: true,
        sentReported: false,
      });

      // Next start: recovery must report NEEDS_REVIEW, never SENT.
      state.eventThrowFor = null;
      await runner.recover();
      expect(state.events.some((event) => event.type === "NEEDS_REVIEW")).toBe(true);
      latest = await outbox.latestByJob();
      expect(latest.get("job-1")?.state).toBe("NEEDS_REVIEW_REPORTED");
      await outbox.close();
    });
  });

  it("exposes the earliest retry due date for the loop's claim delay", async () => {
    await withTempDir(async (dir) => {
      const outbox = new Outbox(path.join(dir, "outbox.jsonl"));
      const { api, state } = createFakeApi();
      state.claimQueue.push(makeJob());
      const runner = createRunner(api, outbox, {
        createTransport: () => new FakeTransport({ connectFail: true }),
        retryBackoffMs: 60000,
      });

      expect(await runner.earliestRetryDue()).toBeNull();
      await runner.runOnce();
      const due = await runner.earliestRetryDue();
      expect(due).not.toBeNull();
      expect(due as number).toBeGreaterThan(Date.now() + 30000);
      await outbox.close();
    });
  });
});
