import { requireRole } from "~~/server/utils/auth";
import { prisma } from "~~/server/utils/prisma";

// PRN-03: soft delete the logical printer. Refused while QUEUED jobs remain so
// the bridge never loses work it would still have to claim.
export default defineEventHandler(async (event) => {
  requireRole(event, ["EMPLOYEE", "ADMIN"]);
  const id = getRouterParam(event, "id");
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: "ไม่พบเครื่องพิมพ์ที่ระบุ" });
  }

  const printer = await prisma.printer.findFirst({
    where: { id, deletedAt: null },
    select: { id: true },
  });
  if (!printer) {
    throw createError({ statusCode: 404, statusMessage: "ไม่พบเครื่องพิมพ์ที่ระบุ" });
  }

  const activeQueuedCount = await prisma.printJob.count({
    where: { printerId: printer.id, status: "QUEUED", deletedAt: null },
  });
  if (activeQueuedCount > 0) {
    throw createError({
      statusCode: 409,
      statusMessage: `ยังมีงานพิมพ์ในคิวอยู่ ${activeQueuedCount} รายการ กรุณารอให้คิวว่างก่อนลบเครื่องพิมพ์`,
    });
  }

  await prisma.printer.update({
    where: { id: printer.id },
    data: { deletedAt: new Date(), isActive: false },
  });

  return { ok: true };
});
