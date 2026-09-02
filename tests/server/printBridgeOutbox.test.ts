// PRN-04 bridge outbox durability tests: append + fsync, last-wins replay,
// simulated crash (fresh instance reading the same file) and torn-line skip.

import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { Outbox } from "../../print-bridge/outbox.mjs";
import { withTempDir } from "./printBridgeTestHelpers";

function record(jobId: string, state: string, extra: Record<string, unknown> = {}) {
  return {
    jobId,
    attempts: 1,
    state,
    leaseToken: "lease-1",
    fencingToken: 7,
    lastEventAt: new Date().toISOString(),
    bytesWritten: false,
    sentReported: false,
    nextAttemptAt: null,
    ...extra,
  };
}

describe("print bridge outbox durability", () => {
  it("appends records with an explicit sync and reads them back", async () => {
    await withTempDir(async (dir) => {
      const outboxPath = path.join(dir, "outbox.jsonl");
      const outbox = new Outbox(outboxPath);

      await outbox.append(record("job-1", "PROCESSING"));
      await outbox.append(record("job-1", "SENT_REPORTED", { bytesWritten: true, sentReported: true }));
      await outbox.close();

      const raw = await readFile(outboxPath, "utf8");
      expect(raw.trimEnd().split("\n")).toHaveLength(2);
      expect(raw).toContain('"state":"PROCESSING"');

      const records = await outbox.readAll();
      expect(records).toHaveLength(2);
      expect(records[1]?.state).toBe("SENT_REPORTED");
    });
  });

  it("resumes correct state in a fresh instance after a simulated crash", async () => {
    await withTempDir(async (dir) => {
      const outboxPath = path.join(dir, "outbox.jsonl");
      const first = new Outbox(outboxPath);
      // Crash mid-send: bytes written, SENT never confirmed.
      await first.append(record("job-1", "SENDING", { bytesWritten: true, sentReported: false }));
      // Another job queued for retry with its attempt count.
      await first.append(
        record("job-2", "RETRY_WAIT", {
          attempts: 2,
          nextAttemptAt: new Date(Date.now() + 30_000).toISOString(),
        }),
      );
      // Instance is NOT closed (simulated crash); a new instance reads the file.
      const second = new Outbox(outboxPath);
      const latest = await second.latestByJob();

      expect(latest.get("job-1")).toMatchObject({
        state: "SENDING",
        bytesWritten: true,
        sentReported: false,
        leaseToken: "lease-1",
        fencingToken: 7,
      });
      expect(latest.get("job-2")).toMatchObject({ state: "RETRY_WAIT", attempts: 2 });
    });
  });

  it("treats the last record per job as current state (last-write-wins)", async () => {
    await withTempDir(async (dir) => {
      const outboxPath = path.join(dir, "outbox.jsonl");
      const outbox = new Outbox(outboxPath);
      await outbox.append(record("job-1", "PROCESSING"));
      await outbox.append(record("job-1", "RETRY_WAIT", { attempts: 1 }));
      await outbox.append(record("job-1", "SENT_REPORTED", { bytesWritten: true, sentReported: true }));

      const latest = await outbox.latestByJob();
      expect(latest.size).toBe(1);
      expect(latest.get("job-1")?.state).toBe("SENT_REPORTED");
    });
  });

  it("skips torn or corrupt trailing lines instead of failing startup", async () => {
    await withTempDir(async (dir) => {
      const outboxPath = path.join(dir, "outbox.jsonl");
      const outbox = new Outbox(outboxPath);
      await outbox.append(record("job-1", "PROCESSING"));
      await outbox.close();
      // Simulate a power loss mid-write: torn trailing line.
      await import("node:fs/promises").then((fs) =>
        fs.writeFile(outboxPath, '{"jobId":"job-2","state":"PROC', { flag: "a" }),
      );

      const records = await outbox.readAll();
      expect(records).toHaveLength(1);
      expect(records[0]?.jobId).toBe("job-1");
    });
  });
});
