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
    select: { id: true, role: true, customerAccountStatus: true },
  });

  if (!user) {
    throw createError({ statusCode: 404, statusMessage: "ไม่พบผู้ใช้งาน" });
  }
  if (user.role !== "USER") {
    throw createError({ statusCode: 400, statusMessage: "ผู้ใช้นี้ไม่ใช่ลูกค้าทั่วไป" });
  }
  if (user.customerAccountStatus === "OFFLINE") {
    throw createError({ statusCode: 409, statusMessage: "ต้องเปิดใช้งานบัญชีลูกค้าก่อนเปลี่ยนเป็นพนักงาน" });
  }

  const updated = await prisma.user.update({
    where: { id: body.userId },
    data: { role: body.role },
    select: { id: true, name: true, email: true, role: true, image: true, phoneNumber: true, createdAt: true },
  });

  return updated;
});
