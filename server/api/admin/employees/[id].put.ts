import { z } from "zod/v4";
import { prisma } from "~~/server/utils/prisma";
import { requireRole } from "~~/server/utils/auth";
import { normalizeThaiPhoneNumber } from "~~/shared/utils/phone";

const schema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  phoneNumber: z.string().trim().max(20).nullish(),
  role: z.enum(["EMPLOYEE", "ADMIN"]).optional(),
});

export default defineEventHandler(async (event) => {
  const actor = requireRole(event, ["ADMIN"]);
  const id = getRouterParam(event, "id");
  if (!id) throw createError({ statusCode: 400, statusMessage: "Missing id" });

  const target = await prisma.user.findFirst({
    where: { id, deletedAt: null },
    select: { id: true, role: true },
  });
  if (!target) throw createError({ statusCode: 404, statusMessage: "ไม่พบพนักงาน" });

  const body = await readValidatedBody(event, schema.parse);
  const phoneNumber = body.phoneNumber === undefined ? undefined : body.phoneNumber?.trim() || null;
  const normalizedPhoneNumber = phoneNumber ? normalizeThaiPhoneNumber(phoneNumber) : phoneNumber;
  if (phoneNumber && !normalizedPhoneNumber) {
    throw createError({ statusCode: 400, statusMessage: "เบอร์โทรศัพท์ไม่ถูกต้อง" });
  }

  if (body.role && id === actor.id && body.role !== "ADMIN") {
    throw createError({ statusCode: 400, statusMessage: "ห้ามลด role ของตัวเอง" });
  }

  await prisma.user.update({
    where: { id },
    data: {
      name: body.name ?? undefined,
      phoneNumber,
      normalizedPhoneNumber,
      role: body.role,
    },
  });

  return { success: true };
});
