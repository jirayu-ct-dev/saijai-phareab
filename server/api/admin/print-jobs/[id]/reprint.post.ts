import { randomUUID } from "node:crypto";
import { requireRole } from "~~/server/utils/auth";
import { prisma } from "~~/server/utils/prisma";
import { buildPrintJobIdempotencyKey } from "~~/shared/utils/printJobState";
import type { PrintJobStatus } from "~~/shared/types/printing";
import { PRINT_JOB_RENDER_VERSION, appendTimeline, projectPrintJob } from "~~/server/utils/printJobQueue";

// Statuses a reprint may originate from: the job finished (however it ended)
// or is parked in needs-review / stale / failed. Active queue states must go
// through their normal lifecycle instead.
const REPRINTABLE_STATUSES: readonly PrintJobStatus[] = [
  "NEEDS_REVIEW",
  "STALE_DOCUMENT",
  "FAILED",
  "SENT",
  "ACKNOWLEDGED",
  "RESOLVED_PRINTED",
  "RESOLVED_NOT_PRINTED",
  "REPRINTED",
];

// PRN-03: explicit reprint — a NEW job that copies the original snapshot with
// a fresh idempotency scope. Stale-guard data is copied so the C9 guard still
// compares the same document against live payment state at claim time.
export default defineEventHandler(async (event) => {
  const actor = requireRole(event, ["EMPLOYEE", "ADMIN"]);
  const id = getRouterParam(event, "id");
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: "ไม่พบงานพิมพ์ที่ระบุ" });
  }

  const result = await prisma.$transaction(async (tx) => {
    const original = await tx.printJob.findFirst({ where: { id, deletedAt: null } });
    if (!original) {
      throw createError({ statusCode: 404, statusMessage: "ไม่พบงานพิมพ์ที่ระบุ" });
    }
    if (!REPRINTABLE_STATUSES.includes(original.status)) {
      throw createError({
        statusCode: 409,
        statusMessage: "งานนี้ยังอยู่ระหว่างพิมพ์ ไม่สามารถสั่งพิมพ์ซ้ำได้ในขณะนี้",
      });
    }

    const now = new Date();
    const reprint = await tx.printJob.create({
      data: {
        printerId: original.printerId,
        kind: original.kind,
        documentId: original.documentId,
        documentNo: original.documentNo,
        documentRevision: original.documentRevision,
        status: "QUEUED",
        sourcePaymentId: original.sourcePaymentId,
        sourceStatus: original.sourceStatus,
        sourceRevision: original.sourceRevision,
        amountMinor: original.amountMinor,
        qrConfigVersion: original.qrConfigVersion,
        snapshotHasPaymentQr: original.snapshotHasPaymentQr,
        snapshot: original.snapshot as object,
        snapshotHash: original.snapshotHash,
        renderVersion: PRINT_JOB_RENDER_VERSION,
        snapshotExpiresAt: null,
        requestedById: actor.id,
        selectedTransport: original.selectedTransport,
        idempotencyKey: buildPrintJobIdempotencyKey({
          requestedById: actor.id,
          documentType: original.kind,
          documentId: original.documentId,
          transport: original.selectedTransport,
          requestId: randomUUID(),
        }),
        reprintOfId: original.id,
        availableAt: now,
        timeline: [
          {
            at: now.toISOString(),
            status: "QUEUED",
            note: `สั่งพิมพ์ซ้ำจากงาน ${original.id}`,
          },
        ],
      },
    });

    // Note the reprint on the original. NEEDS_REVIEW additionally transitions
    // to REPRINTED (frozen state machine); other finished statuses only get a
    // timeline note so their history stays intact.
    const originalTimeline = appendTimeline(original.timeline, {
      at: now.toISOString(),
      status: original.status === "NEEDS_REVIEW" ? "REPRINTED" : original.status,
      note: `มีการสั่งพิมพ์ซ้ำเป็นงาน ${reprint.id}`,
    });
    await tx.printJob.update({
      where: { id: original.id },
      data: {
        ...(original.status === "NEEDS_REVIEW" ? { status: "REPRINTED" as const } : {}),
        timeline: originalTimeline,
      },
    });

    return reprint;
  });

  return { job: projectPrintJob(result) };
});
