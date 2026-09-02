/**
 * Durable outbox: an append-only JSON-lines file with an explicit fsync after
 * every append. One record per append; for a given job the LAST record in the
 * file wins (state is reconciled by replaying the file).
 *
 * Record shape (per PRN-04):
 *   {
 *     jobId: string,
 *     attempts: number,          // local send attempts consumed
 *     state: string,             // PROCESSING | SENDING | RETRY_WAIT |
 *                                // SENT_REPORTED | NEEDS_REVIEW_REPORTED | DROPPED
 *     leaseToken: string | null,
 *     fencingToken: number | null,
 *     lastEventAt: string,       // ISO 8601
 *     bytesWritten: boolean,     // any byte may have reached the printer
 *     sentReported: boolean,     // SENT event accepted by the server
 *     nextAttemptAt: string|null // ISO 8601 backoff due date (RETRY_WAIT)
 *   }
 *
 * Crash-safety rule (C8): a record with bytesWritten=true and sentReported=false
 * means "bytes may have printed but the server was never told SENT" — the next
 * start MUST report NEEDS_REVIEW, never retry silently.
 */

import { mkdir, open, readFile } from "node:fs/promises";
import path from "node:path";

export class Outbox {
  /** @type {import("node:fs/promises").FileHandle|null} */
  #handle = null;

  constructor(filePath) {
    if (typeof filePath !== "string" || filePath.trim().length === 0) {
      throw new Error("Outbox requires a file path");
    }
    this.filePath = filePath;
  }

  async #ensureOpen() {
    if (this.#handle) return;
    await mkdir(path.dirname(this.filePath), { recursive: true });
    this.#handle = await open(this.filePath, "a");
  }

  /** Appends one record and fsyncs the file before resolving. */
  async append(record) {
    await this.#ensureOpen();
    const line = JSON.stringify(record);
    await this.#handle.write(line + "\n");
    await this.#handle.sync();
  }

  /** Parses every well-formed record from the file (corrupt lines skipped). */
  async readAll() {
    let text;
    try {
      text = await readFile(this.filePath, "utf8");
    } catch {
      return [];
    }
    const records = [];
    for (const line of text.split("\n")) {
      const trimmed = line.trim();
      if (trimmed.length === 0) continue;
      try {
        const parsed = JSON.parse(trimmed);
        if (parsed && typeof parsed === "object" && typeof parsed.jobId === "string") {
          records.push(parsed);
        }
      } catch {
        // Torn/corrupt trailing line (e.g. power loss mid-write) — skip it.
      }
    }
    return records;
  }

  /** Latest record per jobId (last append wins). */
  async latestByJob() {
    const latest = new Map();
    for (const record of await this.readAll()) {
      latest.set(record.jobId, record);
    }
    return latest;
  }

  /** Closes the underlying file handle (records are already fsynced). */
  async close() {
    if (!this.#handle) return;
    const handle = this.#handle;
    this.#handle = null;
    await handle.close();
  }
}
