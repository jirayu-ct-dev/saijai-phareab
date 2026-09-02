import { z } from "zod";
import { requireRole } from "~~/server/utils/auth";
import { prisma } from "~~/server/utils/prisma";
import { canTransitionPrintJobStatus } from "~~/shared/utils/printJobState";
import { appendTimeline, projectPrintJob } from "~~/server/utils/printJobQueue";

const bodySchema = z.object({
  resolution: z.enum(["RESOLVED_PRINTED", "RESOLVED_NOT_PRINTED"]),
  note: z.string().trim().max(500).optional(),
});

// PRN-03: manual needs-review resolution (C8 — never silently retried).
export default defineEventHandler(async (event) => {
  requireRole(event, ["EMPLOYEE", "ADMIN"]);
  const id = getRouterParam(event, "id");
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: "ไม่พบงานพิมพ์ที่ระบุ" });
  }
  const body = await readValidatedBody(event, bodySchema.parse);

  const job = await prisma.$transaction(async (tx) => {
    const job = await tx.printJob.findFirst({ where: { id, deletedAt: null } });
    if (!job) {
      throw createError({ statusCode: 404, statusMessage: "ไม่พบงานพิมพ์ที่ระบุ" });
    }
    if (!canTransitionPrintJobStatus(job.status, body.resolution)) {
      throw createError({
        statusCode: 409,
        statusMessage: "งานนี้ไม่อยู่ในสถานะที่ตรวจสอบได้ (ต้องเป็น 'ต้องตรวจสอบ' ก่อน)",
      });
    }

    const now = new Date();
    const updated = await tx.printJob.update({
      where: { id: job.id },
      data: {
        status: body.resolution,
        leaseToken: null,
        leaseExpiresAt: null,
        timeline: appendTimeline(job.timeline, {
          at: now.toISOString(),
          status: body.resolution,
          note: body.note ?? null,
        }),
      },
    });
    return updated;
  });

  return { job: projectPrintJob(job) };
});
