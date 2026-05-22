import { z } from "zod/v4";
import { prisma } from "~~/server/utils/prisma";
import { requireRole } from "~~/server/utils/auth";

const schema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  phoneNumber: z.string().trim().max(20).nullish(),
});

export default defineEventHandler(async (event) => {
  requireRole(event, ["ADMIN"]);
  const id = getRouterParam(event, "id");
  if (!id) throw createError({ statusCode: 400, statusMessage: "Missing id" });

  const target = await prisma.user.findFirst({
    where: { id, deletedAt: null, role: "USER" },
    select: { id: true, email: true },
  });
  if (!target) throw createError({ statusCode: 404, statusMessage: "ไม่พบลูกค้า" });
  if (target.email === "walkin@saijai.local") {
    throw createError({ statusCode: 400, statusMessage: "ห้ามแก้ไขข้อมูลลูกค้าหน้าร้าน" });
  }

  const body = await readValidatedBody(event, schema.parse);

  await prisma.user.update({
    where: { id },
    data: {
      name: body.name ?? undefined,
      phoneNumber: body.phoneNumber ?? undefined,
    },
  });

  return { success: true };
});
