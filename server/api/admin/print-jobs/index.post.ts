import { z } from "zod";
import { requireRole } from "~~/server/utils/auth";
import { prisma } from "~~/server/utils/prisma";
import { createPrintJob, projectPrintJob } from "~~/server/utils/printJobQueue";

const bodySchema = z.object({
  kind: z.enum(["RECEIPT", "QUOTATION"]),
  // v1: RECEIPT -> paymentId, QUOTATION -> serviceOrderId.
  documentId: z.string().trim().min(1, "กรุณาระบุเอกสาร").max(64),
  transport: z.enum(["WIFI", "ETHERNET", "USB", "BLUETOOTH"]).optional(),
  idempotencyKey: z
    .string()
    .trim()
    .min(8, "idempotencyKey ต้องมี 8-64 ตัวอักษร")
    .max(64, "idempotencyKey ต้องมี 8-64 ตัวอักษร"),
});

// PRN-03: create a print job (full flow lives in createPrintJob — one
// consistent transaction, exact money, snapshot safety, idempotent).
export default defineEventHandler(async (event) => {
  const actor = requireRole(event, ["EMPLOYEE", "ADMIN"]);
  const body = await readValidatedBody(event, bodySchema.parse);

  try {
    const result = await createPrintJob(prisma, {
      actorId: actor.id,
      kind: body.kind,
      documentId: body.documentId,
      transport: body.transport,
      idempotencyKey: body.idempotencyKey,
    });
    return {
      existing: result.existing,
      job: projectPrintJob(result.job as Parameters<typeof projectPrintJob>[0]),
    };
  } catch (error) {
    if (error && typeof error === "object" && "statusCode" in error) throw error;
    console.error("[POST /api/admin/print-jobs]", error);
    throw createError({
      statusCode: 500,
      statusMessage: "ไม่สามารถสร้างงานพิมพ์ได้",
    });
  }
});
