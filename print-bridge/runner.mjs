/**
 * Job runner (PRN-04) — claim → render → send → report, with C8 lease/fencing
 * semantics and crash-safe outbox reconciliation.
 *
 * Pipeline per claimed job (events always carry leaseToken + fencingToken):
 *   REPORT RENDERING → encode → REPORT READY → transport.connect()
 *   → REPORT SENDING (best-effort) → write bytes → REPORT SENT
 *
 * Failure rules:
 *   - Failure BEFORE any byte was written (connect refused, render error,
 *     known-zero-byte write error): report FAILED with a safe code, park the
 *     job as RETRY_WAIT in the outbox with attempts+1 and a backoff due date.
 *     After maxAttempts send attempts, report NEEDS_REVIEW instead.
 *   - Failure AFTER bytes were written, or with UNKNOWN progress (hang/timeout
 *     mid-write, crash before SENT was reported): report NEEDS_REVIEW and stop
 *     retrying. Never silently retry a possibly-printed job.
 *   - Any event rejected with a stale reason (stale fencing / stale lease):
 *     drop the job locally, log safely, never retry.
 *
 * Restart recovery (recover(), run at every loop start):
 *   - bytesWritten=true and sentReported=false  -> report NEEDS_REVIEW
 *   - mid-pipeline without bytes                -> RETRY_WAIT (re-claim later;
 *     attempts preserved so the max still applies across restarts)
 */

const TERMINAL_OUTBOX_STATES = new Set([
  "SENT_REPORTED",
  "NEEDS_REVIEW_REPORTED",
  "DROPPED",
]);

export function isStaleRejection(reason) {
  return typeof reason === "string" && /stale/i.test(reason);
}

export function createJobRunner({
  printerId,
  api,
  encodeOperations,
  createTransport,
  outbox,
  mutex,
  maxAttempts = 3,
  retryBackoffMs = 30000,
  log = console,
  nowMs = () => Date.now(),
}) {
  if (!printerId) throw new Error("createJobRunner requires printerId");
  if (!api || !encodeOperations || !createTransport || !outbox || !mutex) {
    throw new Error("createJobRunner requires api, encodeOperations, createTransport, outbox, mutex");
  }

  const iso = () => new Date(nowMs()).toISOString();

  function baseRecord(job, previous) {
    return {
      jobId: job.jobId,
      attempts: previous?.attempts ?? 0,
      state: "PROCESSING",
      leaseToken: job.leaseToken ?? null,
      fencingToken: job.fencingToken ?? null,
      lastEventAt: iso(),
      bytesWritten: false,
      sentReported: false,
      nextAttemptAt: null,
    };
  }

  async function reportEvent(jobLike, type, extra = {}) {
    const event = {
      jobId: jobLike.jobId,
      leaseToken: jobLike.leaseToken ?? null,
      fencingToken: jobLike.fencingToken ?? null,
      type,
      ...extra,
    };
    let result;
    try {
      const response = await api.reportEvents([event]);
      result = response?.results?.[0];
    } catch (err) {
      log.warn(`Event ${type} for job ${jobLike.jobId} could not be delivered`, err?.message);
      result = { jobId: jobLike.jobId, accepted: false, reason: "network-error" };
    }
    if (!result || typeof result.accepted !== "boolean") {
      log.warn(`Event ${type} for job ${jobLike.jobId} got a malformed server response`);
      result = { jobId: jobLike.jobId, accepted: false, reason: "malformed-response" };
    }
    return result;
  }

  async function dropJob(jobId, reason) {
    log.info(`Dropping job ${jobId} locally: ${reason}`);
    await outbox.append({
      jobId,
      attempts: 0,
      state: "DROPPED",
      leaseToken: null,
      fencingToken: null,
      lastEventAt: iso(),
      bytesWritten: false,
      sentReported: false,
      nextAttemptAt: null,
    });
  }

  /**
   * Handles an accepted:false event result. Returns true when processing may
   * continue; false when the job was dropped (stale) or parked.
   */
  async function handleRejection(jobLike, result, previousRecord) {
    if (result.accepted) return true;
    if (isStaleRejection(result.reason)) {
      await dropJob(jobLike.jobId, result.reason);
      return false;
    }
    // Non-stale rejection (e.g. lease expired server-side, network error):
    // stop the pipeline; the server will re-queue after lease expiry and the
    // outbox keeps the attempt count.
    await outbox.append({
      ...previousRecord,
      state: "RETRY_WAIT",
      lastEventAt: iso(),
    });
    return false;
  }

  /** Pre-bytes failure: bounded retry with backoff, NEEDS_REVIEW at the cap. */
  async function failBeforeBytes(job, record, failureCode, messageSafe) {
    const attempts = (record.attempts ?? 0) + 1;
    if (attempts >= maxAttempts) {
      log.warn(`Job ${job.jobId} exhausted ${attempts} attempts; reporting NEEDS_REVIEW`);
      const result = await reportEvent(job, "NEEDS_REVIEW", {
        failureCode: "NEEDS_REVIEW",
        failureMessageSafe: messageSafe,
      });
      if (result.accepted) {
        await outbox.append({
          ...record,
          attempts,
          state: "NEEDS_REVIEW_REPORTED",
          lastEventAt: iso(),
        });
      } else if (isStaleRejection(result.reason)) {
        await dropJob(job.jobId, result.reason);
      } else {
        await outbox.append({ ...record, attempts, state: "RETRY_WAIT", lastEventAt: iso() });
      }
      return;
    }

    const result = await reportEvent(job, "FAILED", { failureCode, failureMessageSafe: messageSafe });
    if (isStaleRejection(result.reason)) {
      await dropJob(job.jobId, result.reason);
      return;
    }
    const nextAttemptAt = new Date(nowMs() + retryBackoffMs * attempts).toISOString();
    await outbox.append({
      ...record,
      attempts,
      state: "RETRY_WAIT",
      nextAttemptAt,
      lastEventAt: iso(),
    });
  }

  async function processJob(job) {
    if (!job || typeof job.jobId !== "string") {
      log.warn("Claim returned a malformed job; ignoring it");
      return;
    }

    const latest = await outbox.latestByJob();
    const existing = latest.get(job.jobId);
    if (existing && TERMINAL_OUTBOX_STATES.has(existing.state)) {
      return; // already resolved locally (SENT / NEEDS_REVIEW / dropped)
    }
    if (!job.leaseExpiresAt || Date.parse(job.leaseExpiresAt) <= nowMs()) {
      log.warn(`Job ${job.jobId} arrived with an expired lease; skipping until the server re-queues it`);
      return;
    }

    let record = baseRecord(job, existing);
    await outbox.append(record);

    // 1. RENDERING
    let result = await reportEvent(job, "RENDERING");
    if (!(await handleRejection(job, result, record))) return;

    // 2. Encode
    let bytes;
    try {
      bytes = await encodeOperations(job.operations ?? []);
      if (!(bytes instanceof Uint8Array) || bytes.byteLength === 0) {
        throw new Error("encoder returned an empty payload");
      }
    } catch (err) {
      log.warn(`Rendering job ${job.jobId} failed`, err?.message);
      await failBeforeBytes(job, record, "FAILED_RENDER", "เตรียมข้อมูลสำหรับพิมพ์ไม่สำเร็จ");
      return;
    }

    // 3. READY
    result = await reportEvent(job, "READY");
    if (!(await handleRejection(job, result, record))) return;

    // 4. Connect
    let transport;
    try {
      transport = createTransport(job);
      await transport.connect();
    } catch (err) {
      log.warn(`Connecting to the printer for job ${job.jobId} failed`, err?.message);
      await failBeforeBytes(job, record, err?.code ?? "FAILED_OFFLINE", "เครื่องพิมพ์ไม่พร้อมใช้งาน");
      return;
    }

    // 5. SENDING (best-effort: never proceed to write on a rejected event)
    result = await reportEvent(job, "SENDING");
    if (!(await handleRejection(job, result, record))) {
      await transport.close?.();
      return;
    }

    // 6. Write bytes
    let bytesBeforeCall = 0;
    try {
      const written = await transport.write(bytes);
      bytesBeforeCall += typeof written === "number" ? written : 0;
      if (typeof transport.end === "function") {
        await transport.end();
      }
    } catch (err) {
      await transport.close?.();
      // Partial bytes known -> count them; unknown (no bytesWritten on the
      // error, e.g. hang/timeout mid-write) -> assume bytes may have printed.
      const writtenNow =
        typeof err?.bytesWritten === "number" ? bytesBeforeCall + err.bytesWritten : null;
      if (writtenNow === null || writtenNow > 0) {
        log.warn(
          `Job ${job.jobId} send outcome is uncertain (${writtenNow === null ? "unknown" : writtenNow} bytes reached the printer); reporting NEEDS_REVIEW`,
        );
        const review = await reportEvent(job, "NEEDS_REVIEW", {
          failureCode: "NEEDS_REVIEW",
          failureMessageSafe: "ส่งงานไม่ชัดเจน ต้องตรวจใบที่เครื่องพิมพ์ก่อน",
        });
        if (review.accepted) {
          await outbox.append({
            ...record,
            state: "NEEDS_REVIEW_REPORTED",
            bytesWritten: true,
            sentReported: true,
            lastEventAt: iso(),
          });
        } else if (isStaleRejection(review.reason)) {
          await dropJob(job.jobId, review.reason);
        } else {
          // Recovery on the next start will re-report NEEDS_REVIEW (C8).
          await outbox.append({
            ...record,
            state: "SENDING",
            bytesWritten: true,
            sentReported: false,
            lastEventAt: iso(),
          });
        }
        return;
      }
      // Known zero bytes -> safe bounded retry path.
      log.warn(`Job ${job.jobId} failed before any byte was written`, err?.message);
      await failBeforeBytes(job, record, err?.code ?? "FAILED_DEVICE", "ส่งงานไปเครื่องพิมพ์ไม่สำเร็จ");
      return;
    }

    // 7. SENT
    const sent = await reportEvent(job, "SENT");
    if (sent.accepted) {
      await outbox.append({
        ...record,
        state: "SENT_REPORTED",
        bytesWritten: true,
        sentReported: true,
        lastEventAt: iso(),
      });
    } else if (isStaleRejection(sent.reason)) {
      await dropJob(job.jobId, sent.reason);
    } else {
      // Bytes were written but SENT was not confirmed: the next recovery
      // reports NEEDS_REVIEW (never a silent retry).
      await outbox.append({
        ...record,
        state: "SENDING",
        bytesWritten: true,
        sentReported: false,
        lastEventAt: iso(),
      });
    }
  }

  /** Crash/restart reconciliation over the outbox. */
  async function recover() {
    const latest = await outbox.latestByJob();
    for (const [jobId, record] of latest) {
      if (TERMINAL_OUTBOX_STATES.has(record.state)) continue;
      if (record.bytesWritten && !record.sentReported) {
        log.warn(`Job ${jobId} had bytes written without a SENT confirmation; reporting NEEDS_REVIEW`);
        const result = await reportEvent(
          { jobId, leaseToken: record.leaseToken, fencingToken: record.fencingToken },
          "NEEDS_REVIEW",
          {
            failureCode: "NEEDS_REVIEW",
            failureMessageSafe: "บริดจ์รีสตาร์ทหลังจากส่งข้อมูลไปเครื่องพิมพ์ ต้องตรวจใบก่อน",
          },
        );
        if (result.accepted) {
          await outbox.append({
            ...record,
            state: "NEEDS_REVIEW_REPORTED",
            sentReported: true,
            lastEventAt: iso(),
          });
        } else if (isStaleRejection(result.reason)) {
          await dropJob(jobId, result.reason);
        }
        // Other rejections: keep the record so the next recover() retries the report.
      } else if (record.state === "PROCESSING" || record.state === "SENDING") {
        await outbox.append({ ...record, state: "RETRY_WAIT", lastEventAt: iso() });
      }
      // RETRY_WAIT records are kept as-is: attempts/backoff survive restarts.
    }
  }

  /**
   * One bridge cycle under the per-printer mutex: recover, claim, process.
   * @throws when the per-printer mutex is already held (overlapping send loop)
   */
  async function runOnce(maxJobs = 5) {
    const release = mutex.acquire(printerId);
    try {
      await recover();
      let claim;
      try {
        claim = await api.claim(maxJobs);
      } catch (err) {
        log.warn("Claim failed this cycle", err?.message);
        return { claimed: 0, processed: 0 };
      }
      const jobs = Array.isArray(claim?.jobs) ? claim.jobs : [];
      for (const job of jobs) {
        await processJob(job);
      }
      return { claimed: jobs.length, processed: jobs.length };
    } finally {
      release();
    }
  }

  /** Earliest RETRY_WAIT backoff due date (epoch ms) or null. */
  async function earliestRetryDue() {
    const latest = await outbox.latestByJob();
    let min = null;
    for (const record of latest.values()) {
      if (record.state !== "RETRY_WAIT" || !record.nextAttemptAt) continue;
      const due = Date.parse(record.nextAttemptAt);
      if (!Number.isNaN(due) && (min === null || due < min)) min = due;
    }
    return min;
  }

  return { runOnce, recover, earliestRetryDue, processJob };
}
