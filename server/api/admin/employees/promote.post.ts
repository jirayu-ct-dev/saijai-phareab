import { z } from "zod/v4";
import { prisma } from "~~/server/utils/prisma";
import { requireRole } from "~~/server/utils/auth";

const schema = z.object({
  userId: z.string().min(1),
  role: z.enum(["EMPLOYEE", "ADMIN"]),
});

export default defineEventHandler(async (event) => {
  requireRole(event, ["ADMIN"]);
  const body = await readValidatedBody(event, schema.parse);

  const user = await prisma.user.findFirst({
    where: { id: body.userId, deletedAt: null },
    select: { id: true, role: true, email: true },
  });

  if (!user) {
    throw createError({ statusCode: 404, statusMessage: "ไม่พบผู้ใช้งาน" });
  }
  if (user.email === "walkin@saijai.local") {
    throw createError({ statusCode: 400, statusMessage: "ไม่สามารถเปลี่ยนสิทธิ์ผู้ใช้นี้ได้" });
  }
  if (user.role !== "USER") {
    throw createError({ statusCode: 400, statusMessage: "ผู้ใช้นี้ไม่ใช่ลูกค้าทั่วไป" });
  }

  const updated = await prisma.user.update({
    where: { id: body.userId },
    data: { role: body.role },
    select: { id: true, name: true, email: true, role: true, image: true, phoneNumber: true, createdAt: true },
  });

  return updated;
});
