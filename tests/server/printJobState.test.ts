import { describe, expect, it } from "vitest";
import {
  PRINT_JOB_FAILURE_CODE_LABELS,
  PRINT_JOB_TRANSITIONS,
  MAX_PRINT_JOB_TIMELINE_ENTRIES,
  appendPrintJobTimelineEntry,
  buildPrintJobIdempotencyKey,
  canTransitionPrintJobStatus,
  checkPrintJobFreshness,
  classifyPrintJobFailure,
  createPrinterCapabilities,
  evaluatePaymentQrEligibility,
  isFencingTokenCurrent,
  isPaymentQrReceiverActivated,
  isPrintJobStatusTerminal,
  resolvePrintJobLeaseExpiry,
} from "../../shared/utils/printJobState";
import type { PrintJobStatus, PrintJobTimelineEntry } from "../../shared/types/printing";

const baseIdempotencyScope = {
  requestedById: "user-1",
  documentType: "QUOTATION" as const,
  documentId: "payment-1",
  transport: "WIFI" as const,
  requestId: "request-1",
};

describe("print job state transitions", () => {
  it("allows the happy path QUEUED -> ... -> SENT -> ACKNOWLEDGED", () => {
    expect(canTransitionPrintJobStatus("QUEUED", "CLAIMED")).toBe(true);
    expect(canTransitionPrintJobStatus("CLAIMED", "RENDERING")).toBe(true);
    expect(canTransitionPrintJobStatus("RENDERING", "READY")).toBe(true);
    expect(canTransitionPrintJobStatus("READY", "SENDING")).toBe(true);
    expect(canTransitionPrintJobStatus("SENDING", "SENT")).toBe(true);
    expect(canTransitionPrintJobStatus("SENT", "ACKNOWLEDGED")).toBe(true);
  });

  it("allows early states -> RETRY_WAIT -> QUEUED and early states -> STALE_DOCUMENT", () => {
    for (const early of ["QUEUED", "CLAIMED", "RENDERING", "READY"] as const) {
      expect(canTransitionPrintJobStatus(early, "RETRY_WAIT")).toBe(true);
      expect(canTransitionPrintJobStatus(early, "FAILED")).toBe(true);
      expect(canTransitionPrintJobStatus(early, "STALE_DOCUMENT")).toBe(true);
    }
    expect(canTransitionPrintJobStatus("RETRY_WAIT", "QUEUED")).toBe(true);
  });

  it("routes SENDING only to SENT or NEEDS_REVIEW (never silent retry)", () => {
    expect(canTransitionPrintJobStatus("SENDING", "NEEDS_REVIEW")).toBe(true);
    expect(canTransitionPrintJobStatus("SENDING", "SENT")).toBe(true);
    expect(canTransitionPrintJobStatus("SENDING", "FAILED")).toBe(false);
    expect(canTransitionPrintJobStatus("SENDING", "RETRY_WAIT")).toBe(false);
    expect(canTransitionPrintJobStatus("SENDING", "STALE_DOCUMENT")).toBe(false);
  });

  it("allows NEEDS_REVIEW resolution outcomes only", () => {
    expect(canTransitionPrintJobStatus("NEEDS_REVIEW", "RESOLVED_PRINTED")).toBe(true);
    expect(canTransitionPrintJobStatus("NEEDS_REVIEW", "RESOLVED_NOT_PRINTED")).toBe(true);
    expect(canTransitionPrintJobStatus("NEEDS_REVIEW", "REPRINTED")).toBe(true);
    expect(canTransitionPrintJobStatus("NEEDS_REVIEW", "SENDING")).toBe(false);
    expect(canTransitionPrintJobStatus("NEEDS_REVIEW", "FAILED")).toBe(false);
  });

  it("rejects skipping states and shortcuts to SENT", () => {
    expect(canTransitionPrintJobStatus("QUEUED", "SENDING")).toBe(false);
    expect(canTransitionPrintJobStatus("QUEUED", "SENT")).toBe(false);
    expect(canTransitionPrintJobStatus("READY", "SENT")).toBe(false);
    expect(canTransitionPrintJobStatus("CLAIMED", "SENDING")).toBe(false);
    expect(canTransitionPrintJobStatus("RETRY_WAIT", "SENDING")).toBe(false);
  });

  it("rejects transitions out of terminal states", () => {
    const terminal: PrintJobStatus[] = [
      "ACKNOWLEDGED",
      "STALE_DOCUMENT",
      "RESOLVED_PRINTED",
      "RESOLVED_NOT_PRINTED",
      "REPRINTED",
      "FAILED",
    ];
    const all: PrintJobStatus[] = Object.keys(PRINT_JOB_TRANSITIONS) as PrintJobStatus[];
    for (const from of terminal) {
      expect(isPrintJobStatusTerminal(from)).toBe(true);
      for (const to of all) {
        expect(canTransitionPrintJobStatus(from, to)).toBe(false);
      }
    }
  });

  it("covers every status in the transition table", () => {
    const all: PrintJobStatus[] = [
      "QUEUED", "CLAIMED", "RENDERING", "READY", "SENDING", "SENT",
      "ACKNOWLEDGED", "RETRY_WAIT", "STALE_DOCUMENT", "NEEDS_REVIEW",
      "RESOLVED_PRINTED", "RESOLVED_NOT_PRINTED", "REPRINTED", "FAILED",
    ];
    for (const status of all) {
      expect(Array.isArray(PRINT_JOB_TRANSITIONS[status])).toBe(true);
    }
    expect(all).toHaveLength(Object.keys(PRINT_JOB_TRANSITIONS).length);
  });

  it("gives every safe failure code a Thai label", () => {
    expect(Object.keys(PRINT_JOB_FAILURE_CODE_LABELS)).toContain("FAILED_CONFIG");
    expect(Object.keys(PRINT_JOB_FAILURE_CODE_LABELS)).toContain("FAILED_OFFLINE");
    expect(Object.keys(PRINT_JOB_FAILURE_CODE_LABELS)).toContain("FAILED_DEVICE");
    expect(Object.keys(PRINT_JOB_FAILURE_CODE_LABELS)).toContain("STALE_DOCUMENT");
    expect(Object.keys(PRINT_JOB_FAILURE_CODE_LABELS)).toContain("NEEDS_REVIEW");
    for (const label of Object.values(PRINT_JOB_FAILURE_CODE_LABELS)) {
      expect(label.length).toBeGreaterThan(0);
    }
  });
});

describe("idempotency scope key", () => {
  it("is deterministic for the same scope", () => {
    expect(buildPrintJobIdempotencyKey(baseIdempotencyScope)).toBe(
      buildPrintJobIdempotencyKey(baseIdempotencyScope),
    );
  });

  it("differs when any scope component differs", () => {
    const base = buildPrintJobIdempotencyKey(baseIdempotencyScope);
    expect(buildPrintJobIdempotencyKey({ ...baseIdempotencyScope, requestedById: "user-2" })).not.toBe(base);
    expect(buildPrintJobIdempotencyKey({ ...baseIdempotencyScope, documentId: "payment-2" })).not.toBe(base);
    expect(buildPrintJobIdempotencyKey({ ...baseIdempotencyScope, transport: "USB" })).not.toBe(base);
    expect(buildPrintJobIdempotencyKey({ ...baseIdempotencyScope, requestId: "request-2" })).not.toBe(base);
  });

  it("resists delimiter injection from a client-supplied request ID", () => {
    const injection = buildPrintJobIdempotencyKey({
      ...baseIdempotencyScope,
      requestId: 'x","user-2","QUOTATION","payment-2","WIFI","forged',
    });
    expect(injection).not.toBe(
      buildPrintJobIdempotencyKey({ ...baseIdempotencyScope, requestedById: "user-2" }),
    );
  });

  it("rejects empty scope components", () => {
    expect(() =>
      buildPrintJobIdempotencyKey({ ...baseIdempotencyScope, requestId: "" }),
    ).toThrow();
  });
});

describe("bounded timeline", () => {
  const entryAt = (index: number): PrintJobTimelineEntry => ({
    at: new Date(Date.UTC(2026, 8, 2, 0, index)).toISOString(),
    status: "QUEUED",
    note: `entry-${index}`,
  });

  it("appends entries in order", () => {
    const timeline = appendPrintJobTimelineEntry([], entryAt(0));
    expect(timeline).toHaveLength(1);
    expect(timeline[0]?.note).toBe("entry-0");
  });

  it("drops the oldest entries beyond the bound", () => {
    let timeline: PrintJobTimelineEntry[] = [];
    for (let i = 0; i < MAX_PRINT_JOB_TIMELINE_ENTRIES + 5; i++) {
      timeline = appendPrintJobTimelineEntry(timeline, entryAt(i));
    }
    expect(timeline).toHaveLength(MAX_PRINT_JOB_TIMELINE_ENTRIES);
    expect(timeline[0]?.note).toBe("entry-5");
    expect(timeline.at(-1)?.note).toBe(`entry-${MAX_PRINT_JOB_TIMELINE_ENTRIES + 4}`);
  });

  it("rejects invalid bounds", () => {
    expect(() => appendPrintJobTimelineEntry([], entryAt(0), 0)).toThrow();
  });
});

describe("fencing token", () => {
  it("accepts the current token", () => {
    expect(isFencingTokenCurrent(7, 7)).toBe(true);
  });

  it("rejects stale tokens from an older lease", () => {
    expect(isFencingTokenCurrent(7, 6)).toBe(false);
    expect(isFencingTokenCurrent(7, 8)).toBe(false);
  });

  it("rejects null or non-integer tokens", () => {
    expect(isFencingTokenCurrent(null, 7)).toBe(false);
    expect(isFencingTokenCurrent(7, null)).toBe(false);
    expect(isFencingTokenCurrent(Number.NaN, 7)).toBe(false);
    expect(isFencingTokenCurrent(7.5, 7.5)).toBe(false);
  });
});

describe("lease expiry decision", () => {
  it("reports an active lease", () => {
    expect(
      resolvePrintJobLeaseExpiry({
        leaseExpiresAt: "2026-09-02T00:01:00.000Z",
        sendStartedAt: null,
        now: "2026-09-02T00:00:30.000Z",
      }),
    ).toBe("LEASE_ACTIVE");
  });

  it("lets an expired lease before sending return to the queue", () => {
    expect(
      resolvePrintJobLeaseExpiry({
        leaseExpiresAt: "2026-09-02T00:01:00.000Z",
        sendStartedAt: null,
        now: "2026-09-02T00:01:01.000Z",
      }),
    ).toBe("RECLAIMABLE");
  });

  it("routes an expired lease after send start to needs review", () => {
    expect(
      resolvePrintJobLeaseExpiry({
        leaseExpiresAt: "2026-09-02T00:02:00.000Z",
        sendStartedAt: "2026-09-02T00:01:30.000Z",
        now: "2026-09-02T00:02:01.000Z",
      }),
    ).toBe("NEEDS_REVIEW");
  });

  it("routes an expired lease that overlapped sending to needs review even if send started late", () => {
    expect(
      resolvePrintJobLeaseExpiry({
        leaseExpiresAt: "2026-09-02T00:02:00.000Z",
        sendStartedAt: "2026-09-02T00:03:00.000Z",
        now: "2026-09-02T00:03:01.000Z",
      }),
    ).toBe("NEEDS_REVIEW");
  });

  it("rejects invalid date inputs", () => {
    expect(() =>
      resolvePrintJobLeaseExpiry({
        leaseExpiresAt: "not-a-date",
        sendStartedAt: null,
        now: "2026-09-02T00:00:00.000Z",
      }),
    ).toThrow();
  });
});

describe("retry classification", () => {
  it("retries a bounded number of times before sending starts", () => {
    expect(
      classifyPrintJobFailure({ sendStartedAt: null, attemptCount: 0, maxAttempts: 3 }),
    ).toBe("RETRY_WAIT");
    expect(
      classifyPrintJobFailure({ sendStartedAt: null, attemptCount: 2, maxAttempts: 3 }),
    ).toBe("RETRY_WAIT");
  });

  it("fails once attempts are exhausted", () => {
    expect(
      classifyPrintJobFailure({ sendStartedAt: null, attemptCount: 3, maxAttempts: 3 }),
    ).toBe("FAILED");
    expect(
      classifyPrintJobFailure({ sendStartedAt: null, attemptCount: 5, maxAttempts: 3 }),
    ).toBe("FAILED");
  });

  it("never auto-retries after bytes were written", () => {
    expect(
      classifyPrintJobFailure({
        sendStartedAt: "2026-09-02T00:00:00.000Z",
        attemptCount: 0,
        maxAttempts: 5,
      }),
    ).toBe("NEEDS_REVIEW");
  });

  it("rejects invalid attempt counters", () => {
    expect(() =>
      classifyPrintJobFailure({ sendStartedAt: null, attemptCount: -1, maxAttempts: 3 }),
    ).toThrow();
    expect(() =>
      classifyPrintJobFailure({ sendStartedAt: null, attemptCount: 0, maxAttempts: 0 }),
    ).toThrow();
  });
});

describe("payment QR eligibility (create-time)", () => {
  const eligibleInput = {
    documentKind: "QUOTATION" as const,
    paymentStatus: "UNPAID" as const,
    amountMinor: 1,
    paymentQrEnabled: true,
    receiverActivated: true,
  };

  it("accepts an UNPAID quotation with a positive amount and activated receiver", () => {
    expect(evaluatePaymentQrEligibility(eligibleInput)).toEqual({ eligible: true, reasons: [] });
  });

  it("rejects non-quotation documents and non-UNPAID payments", () => {
    expect(evaluatePaymentQrEligibility({ ...eligibleInput, documentKind: "RECEIPT" }).reasons).toContain(
      "DOCUMENT_NOT_QUOTATION",
    );
    for (const paymentStatus of ["PENDING_VERIFICATION", "PAID", "CANCELLED"] as const) {
      expect(evaluatePaymentQrEligibility({ ...eligibleInput, paymentStatus }).reasons).toContain(
        "PAYMENT_NOT_UNPAID",
      );
    }
  });

  it("rejects zero, negative and non-integer amounts", () => {
    for (const amountMinor of [0, -1, 1.5, Number.NaN]) {
      const result = evaluatePaymentQrEligibility({ ...eligibleInput, amountMinor });
      expect(result.eligible).toBe(false);
      expect(result.reasons).toContain("AMOUNT_NOT_POSITIVE");
    }
  });

  it("rejects disabled settings and unactivated receivers", () => {
    expect(evaluatePaymentQrEligibility({ ...eligibleInput, paymentQrEnabled: false }).reasons).toContain(
      "QR_DISABLED",
    );
    expect(evaluatePaymentQrEligibility({ ...eligibleInput, receiverActivated: false }).reasons).toContain(
      "RECEIVER_NOT_ACTIVATED",
    );
  });

  it("treats receiver settings without ciphertext/key version/activation as not activated", () => {
    expect(
      isPaymentQrReceiverActivated({
        paymentQrEnabled: true,
        paymentQrReceiverCiphertext: "enc",
        paymentQrKeyVersion: 1,
        paymentQrActivatedAt: "2026-09-01T00:00:00.000Z",
      }),
    ).toBe(true);
    for (const missing of [
      { paymentQrReceiverCiphertext: null },
      { paymentQrKeyVersion: null },
      { paymentQrActivatedAt: null },
      { paymentQrEnabled: false },
    ]) {
      expect(
        isPaymentQrReceiverActivated({
          paymentQrEnabled: true,
          paymentQrReceiverCiphertext: "enc",
          paymentQrKeyVersion: 1,
          paymentQrActivatedAt: "2026-09-01T00:00:00.000Z",
          ...missing,
        }),
      ).toBe(false);
    }
  });
});

describe("stale-document pre-send check", () => {
  const freshInput = {
    snapshotSourceRevision: 3,
    currentSourceRevision: 3,
    snapshotHasPaymentQr: true,
    snapshotPaymentStatus: "UNPAID" as const,
    currentPaymentStatus: "UNPAID" as const,
    snapshotAmountMinor: 123456,
    currentAmountMinor: 123456,
    snapshotQrConfigVersion: 2,
    currentQrConfigVersion: 2,
    currentPaymentQrEnabled: true,
    currentReceiverActivated: true,
  };

  it("passes when every snapshot fact still matches the source", () => {
    expect(checkPrintJobFreshness(freshInput)).toEqual({ stale: false, reasons: [] });
  });

  it("goes stale on revision mismatch", () => {
    const result = checkPrintJobFreshness({
      ...freshInput,
      currentSourceRevision: 4,
    });
    expect(result.stale).toBe(true);
    expect(result.reasons).toContain("REVISION_MISMATCH");
  });

  it("goes stale when the payment is no longer UNPAID", () => {
    for (const currentPaymentStatus of ["PENDING_VERIFICATION", "PAID", "CANCELLED"] as const) {
      const result = checkPrintJobFreshness({ ...freshInput, currentPaymentStatus });
      expect(result.stale).toBe(true);
      expect(result.reasons).toContain("PAYMENT_STATUS_CHANGED");
    }
  });

  it("goes stale when the exact amount changed or stopped being positive", () => {
    expect(
      checkPrintJobFreshness({ ...freshInput, currentAmountMinor: 123457 }).reasons,
    ).toContain("AMOUNT_MISMATCH");
    const zeroed = checkPrintJobFreshness({ ...freshInput, currentAmountMinor: 0 });
    expect(zeroed.reasons).toContain("AMOUNT_NOT_POSITIVE");
    expect(zeroed.reasons).not.toContain("AMOUNT_MISMATCH");
  });

  it("goes stale when QR settings changed after job creation", () => {
    expect(
      checkPrintJobFreshness({ ...freshInput, currentQrConfigVersion: 3 }).reasons,
    ).toContain("QR_CONFIG_VERSION_MISMATCH");
    expect(
      checkPrintJobFreshness({ ...freshInput, currentPaymentQrEnabled: false }).reasons,
    ).toContain("QR_DISABLED");
    expect(
      checkPrintJobFreshness({ ...freshInput, currentReceiverActivated: false }).reasons,
    ).toContain("RECEIVER_NOT_ACTIVATED");
  });

  it("only requires revision match for snapshots without a payment QR block", () => {
    const noQr = {
      ...freshInput,
      snapshotHasPaymentQr: false,
      snapshotPaymentStatus: "PAID" as const,
      currentPaymentStatus: "PAID" as const,
      snapshotQrConfigVersion: null,
      currentQrConfigVersion: null,
    };
    expect(checkPrintJobFreshness(noQr)).toEqual({ stale: false, reasons: [] });
    // Amount/config changes alone do not invalidate a non-QR snapshot...
    expect(
      checkPrintJobFreshness({ ...noQr, currentAmountMinor: 999 }).stale,
    ).toBe(false);
    // ...but a document revision bump does.
    expect(
      checkPrintJobFreshness({ ...noQr, currentSourceRevision: 4 }).reasons,
    ).toContain("REVISION_MISMATCH");
  });
});

describe("printer capabilities default", () => {
  it("keeps every capability false by default", () => {
    expect(Object.values(createPrinterCapabilities()).every((flag) => !flag)).toBe(true);
  });
});
