import { z } from "zod/v4";
import { prisma } from "~~/server/utils/prisma";
import { requireRole } from "~~/server/utils/auth";
import { auth } from "~/utils/auth";

const schema = z.object({
  email: z.string().email().max(150),
  name: z.string().trim().min(1).max(100),
  phoneNumber: z.string().trim().max(20).nullish(),
  role: z.enum(["EMPLOYEE", "ADMIN"]),
  password: z.string().min(8).max(100),
});

export default defineEventHandler(async (event) => {
  requireRole(event, ["ADMIN"]);
  const body = await readValidatedBody(event, schema.parse);

  const existing = await prisma.user.findFirst({
    where: { email: body.email.toLowerCase().trim(), deletedAt: null },
    select: { id: true },
  });
  if (existing) {
    throw createError({ statusCode: 409, statusMessage: "อีเมลนี้ถูกใช้งานแล้ว" });
  }

  try {
    await auth.api.signUpEmail({
      body: {
        email: body.email.toLowerCase().trim(),
        password: body.password,
        name: body.name,
        role: body.role,
        phoneNumber: body.phoneNumber || undefined,
      },
    } as Parameters<typeof auth.api.signUpEmail>[0]);
  } catch (error) {
    console.error("[POST /api/admin/employees]", error);
    throw createError({ statusCode: 500, statusMessage: "ไม่สามารถสร้างพนักงานได้" });
  }

  return { success: true };
});
