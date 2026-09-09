import { prisma } from "~~/server/utils/prisma";
import { requireRole } from "~~/server/utils/auth";
import { unlinkLineRichMenuForUser } from "~~/server/utils/line-richmenu";

export default defineEventHandler(async (event) => {
  const actor = requireRole(event, ["ADMIN"]);
  const id = getRouterParam(event, "id");
  if (!id) throw createError({ statusCode: 400, statusMessage: "Missing id" });

  if (id === actor.id) {
    throw createError({ statusCode: 400, statusMessage: "ห้ามลบบัญชีของตัวเอง" });
  }

  const target = await prisma.user.findFirst({
    where: { id, deletedAt: null, role: { in: ["ADMIN", "EMPLOYEE"] } },
    select: { id: true },
  });
  if (!target) throw createError({ statusCode: 404, statusMessage: "ไม่พบพนักงาน" });

  try {
    await unlinkLineRichMenuForUser(id);
  } catch (error) {
    console.warn("[DELETE /api/admin/employees/:id] LINE rich menu unlink failed", error);
  }

  await prisma.user.update({
    where: { id },
    data: { deletedAt: new Date(), deletedById: actor.id },
  });

  return { success: true };
});
