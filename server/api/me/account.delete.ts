import { z } from "zod/v4";
import { prisma } from "~~/server/utils/prisma";
import { requireUser } from "~~/server/utils/auth";

const schema = z.object({
  password: z.string().min(1),
});

export default defineEventHandler(async (event) => {
  const actor = requireUser(event);
  const body = await readValidatedBody(event, schema.parse);

  // Block if this is the last ADMIN
  if (actor.role === "ADMIN") {
    const adminCount = await prisma.user.count({
      where: { role: "ADMIN", deletedAt: null, isActive: true },
    });
    if (adminCount <= 1) {
      throw createError({
        statusCode: 400,
        statusMessage: "ไม่สามารถลบบัญชีได้ เนื่องจากคุณเป็นแอดมินคนเดียวในระบบ",
      });
    }
  }

  // Verify password via BetterAuth's credential account
  const account = await prisma.account.findFirst({
    where: { userId: actor.id, providerId: "credential" },
    select: { password: true },
  });

  if (!account?.password) {
    throw createError({ statusCode: 400, statusMessage: "บัญชีนี้ไม่ได้ตั้งรหัสผ่านไว้" });
  }

  const { verifyPassword } = await import("better-auth/crypto");
  const isValid = await verifyPassword({ hash: account.password, password: body.password });
  if (!isValid) {
    throw createError({ statusCode: 401, statusMessage: "รหัสผ่านไม่ถูกต้อง" });
  }

  await prisma.$transaction(async (tx) => {
    await tx.session.deleteMany({ where: { userId: actor.id } });
    await tx.user.update({
      where: { id: actor.id },
      data: { deletedAt: new Date() },
    });
  });

  return { success: true };
});
