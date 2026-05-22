import { z } from "zod/v4";
import { prisma } from "~~/server/utils/prisma";
import { requireRole } from "~~/server/utils/auth";

const schema = z.object({
  userId: z.string().min(1),
});

export default defineEventHandler(async (event) => {
  requireRole(event, ["ADMIN"]);

  const { userId } = await readValidatedBody(event, schema.parse);

  const user = await prisma.user.findFirst({
    where: { id: userId, deletedAt: null },
    select: { id: true, role: true },
  });

  if (!user) {
    throw createError({ statusCode: 404, statusMessage: "ไม่พบผู้ใช้" });
  }

  if (user.role !== "ADMIN" && user.role !== "EMPLOYEE") {
    throw createError({
      statusCode: 400,
      statusMessage: "เพิ่มได้เฉพาะผู้ใช้ที่เป็น ADMIN หรือ EMPLOYEE เท่านั้น",
    });
  }

  const subscriber = await prisma.notificationSubscriber.upsert({
    where: { userId },
    create: { userId },
    update: { isActive: true },
  });

  return subscriber;
});
