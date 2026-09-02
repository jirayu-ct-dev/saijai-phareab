// Shared helpers for the print-bridge (PRN-04) tests.
// Not a *.test.ts file, so vitest never picks it up directly.

import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

export const SILENT_LOG = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
};

export type OutboxRecordish = {
  jobId: string;
  attempts?: number;
  state: string;
  leaseToken: string | null;
  fencingToken: number | null;
  lastEventAt: string;
  bytesWritten?: boolean;
  sentReported?: boolean;
  nextAttemptAt?: string | null;
};

export type FakeClaimJob = {
  jobId: string;
  leaseToken: string;
  fencingToken: number;
  leaseExpiresAt: string;
  kind: string;
  documentNo: string;
  document: unknown;
  operations: unknown[];
  snapshotHash: string;
  renderVersion: string;
};

export function makeJob(overrides: Record<string, unknown> = {}): FakeClaimJob {
  return {
    jobId: "job-1",
    leaseToken: "lease-1",
    fencingToken: 7,
    leaseExpiresAt: new Date(Date.now() + 60_000).toISOString(),
    kind: "RECEIPT",
    documentNo: "R202609030001",
    document: { kind: "RECEIPT", documentNo: "R202609030001" },
    operations: [{ type: "initialize" }],
    snapshotHash: "sha256:abc",
    renderVersion: "v1",
    ...overrides,
  } as FakeClaimJob;
}

type EventResultOverride = {
  match?: (event: Record<string, unknown>) => boolean;
  result: { accepted: boolean; reason?: string };
};

export function createFakeApi(options: { claimDelayMs?: number } = {}) {
  const state = {
    heartbeats: [] as Array<Record<string, unknown>>,
    claimRequests: [] as Array<Record<string, unknown>>,
    claimQueue: [] as FakeClaimJob[],
    events: [] as Array<Record<string, unknown>>,
    eventResultOverrides: [] as EventResultOverride[],
    eventThrowFor: null as null | ((event: Record<string, unknown>) => boolean),
  };

  const api = {
    async heartbeat(body: Record<string, unknown>) {
      state.heartbeats.push(body);
      return { ok: true, serverTime: new Date().toISOString() };
    },
    async claim(body: Record<string, unknown>) {
      if (options.claimDelayMs) {
        await new Promise((resolve) => setTimeout(resolve, options.claimDelayMs));
      }
      state.claimRequests.push(body);
      return { jobs: state.claimQueue.length > 0 ? [...state.claimQueue] : [] };
    },
    async reportEvents(events: Array<Record<string, unknown>>) {
      if (state.eventThrowFor) {
        for (const event of events) {
          if (state.eventThrowFor(event)) {
            throw new Error("simulated network failure");
          }
        }
      }
      state.events.push(...events);
      const results = events.map((event) => {
        const override = state.eventResultOverrides.find(
          (candidate) => !candidate.match || candidate.match(event),
        );
        return override
          ? { jobId: event.jobId as string, ...override.result }
          : { jobId: event.jobId as string, accepted: true };
      });
      return { results };
    },
  };

  return { api, state };
}

export async function withTempDir<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(path.join(tmpdir(), "print-bridge-test-"));
  try {
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

export function encodeFakeOperations(operations: unknown[]): Uint8Array {
  void operations;
  // Distinct ESC/POS-looking payload, larger than test transport thresholds.
  return Uint8Array.from([0x1b, 0x40, 0x01, 0x02, 0x03, 0x04, 0x05]);
}
