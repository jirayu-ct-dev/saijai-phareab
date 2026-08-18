import { z } from "zod";
import { auth } from "~~/app/utils/auth";
import { hashCustomerClaimToken, isInternalCustomerEmail } from "~~/server/utils/customerAccount";
import { enforceCustomerClaimRateLimit } from "~~/server/utils/customerClaimRateLimit";
import { prisma } from "~~/server/utils/prisma";
import { Prisma } from "~~/app/generated/prisma/client";
import { getUserFromEvent } from "~~/server/utils/auth";
import { isCustomerClaimUsable } from "~~/server/utils/customerClaimState";

const schema = z.object({
  token: z.string().min(20).max(200),
  email: z.string().trim().toLowerCase().email().max(320),
  password: z.string().min(8).max(128),
});

export default defineEventHandler(async (event) => {
  if (getUserFromEvent(event)) {
    throw createError({ statusCode: 409, statusMessage: "กรุณาออกจากระบบก่อนเปิดใช้งานบัญชีลูกค้า" });
  }
  enforceCustomerClaimRateLimit(getRequestIP(event, { xForwardedFor: true }) || "unknown");
  const body = await readValidatedBody(event, schema.parse);
  if (isInternalCustomerEmail(body.email)) {
    throw createError({ statusCode: 400, statusMessage: "ไม่สามารถใช้อีเมลภายในระบบได้" });
  }

  const tokenHash = hashCustomerClaimToken(body.token);
  const { hashPassword } = await import("better-auth/crypto");
  const passwordHash = await hashPassword(body.password);

  let claimed: { userId: string; email: string };
  try {
    claimed = await prisma.$transaction(async (tx) => {
      const claim = await tx.customerClaimToken.findUnique({
        where: { tokenHash },
        include: { user: { select: { id: true, deletedAt: true, customerAccountStatus: true } } },
      });
      if (!isCustomerClaimUsable(claim)) {
        throw createError({ statusCode: 400, statusMessage: "รหัสเปิดใช้งานไม่ถูกต้องหรือหมดอายุแล้ว" });
      }

      const emailOwner = await tx.user.findUnique({
        where: { email: body.email },
        select: { id: true },
      });
      if (emailOwner && emailOwner.id !== claim.user.id) {
        throw createError({ statusCode: 409, statusMessage: "อีเมลนี้ถูกใช้งานแล้ว" });
      }

      const now = new Date();
      const consumed = await tx.customerClaimToken.updateMany({
        where: { id: claim.id, usedAt: null, revokedAt: null, expiresAt: { gt: now } },
        data: { usedAt: now },
      });
      if (consumed.count !== 1) {
        throw createError({ statusCode: 409, statusMessage: "รหัสเปิดใช้งานนี้ถูกใช้แล้ว" });
      }

      await tx.user.update({
        where: { id: claim.user.id },
        data: { email: body.email, emailVerified: false, customerAccountStatus: "ACTIVE", claimedAt: now },
      });
      await tx.account.deleteMany({ where: { userId: claim.user.id, providerId: "credential" } });
      await tx.account.create({
        data: {
          id: crypto.randomUUID(),
          userId: claim.user.id,
          providerId: "credential",
          accountId: claim.user.id,
          password: passwordHash,
        },
      });
      await tx.customerClaimToken.updateMany({
        where: { userId: claim.user.id, id: { not: claim.id }, usedAt: null, revokedAt: null },
        data: { revokedAt: now },
      });

      return { userId: claim.user.id, email: body.email };
    });
  } catch (error) {
    if (error && typeof error === "object" && "statusCode" in error) throw error;
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw createError({ statusCode: 409, statusMessage: "อีเมลนี้ถูกใช้งานแล้ว" });
    }
    console.error("[POST /api/auth/claim-customer] Failed to claim account", error);
    throw createError({ statusCode: 500, statusMessage: "ไม่สามารถเปิดใช้งานบัญชีได้" });
  }

  let verificationEmailSent = true;
  try {
    await auth.api.sendVerificationEmail({ body: { email: claimed.email, callbackURL: "/me" } });
  } catch (error) {
    verificationEmailSent = false;
    console.error("[POST /api/auth/claim-customer] Failed to send verification email", error);
  }

  return { success: true, email: claimed.email, verificationEmailSent };
});
