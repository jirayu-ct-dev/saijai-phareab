import { createHash, randomBytes, randomUUID } from "node:crypto";
import { Prisma } from "~~/app/generated/prisma/client";
import { prisma } from "~~/server/utils/prisma";
import { normalizeThaiPhoneNumber } from "~~/shared/utils/phone";

const INTERNAL_EMAIL_DOMAIN = "@saijai.local";
const CLAIM_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type DbClient = Prisma.TransactionClient | typeof prisma;

export type OfflineCustomerInput = {
  name?: string | null;
  phoneNumber?: string | null;
  email?: string | null;
  createdByStaffId: string;
};

export const isInternalCustomerEmail = (email?: string | null): boolean =>
  Boolean(email?.toLowerCase().endsWith(INTERNAL_EMAIL_DOMAIN));

export const isCustomerUniqueConflict = (error: unknown): boolean => {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") return false;
  const detail = `${JSON.stringify(error.meta?.target ?? "")} ${JSON.stringify(error.meta?.constraint ?? "")} ${error.message}`.toLowerCase();
  return detail.includes("email") || detail.includes("normalized_phone") || detail.includes("normalizedphonenumber");
};

export const hashCustomerClaimToken = (token: string): string =>
  createHash("sha256").update(token).digest("hex");

export const customerSummarySelect = {
  id: true,
  role: true,
  name: true,
  email: true,
  phoneNumber: true,
  image: true,
  customerAccountStatus: true,
} satisfies Prisma.UserSelect;

export const toSafeCustomerSummary = <T extends {
  id: string;
  name: string | null;
  email: string;
  phoneNumber: string | null;
  image: string | null;
  customerAccountStatus: "OFFLINE" | "ACTIVE";
}>(customer: T) => ({
  id: customer.id,
  name: customer.name,
  email: isInternalCustomerEmail(customer.email) ? null : customer.email,
  phoneNumber: customer.phoneNumber,
  image: customer.image,
  customerAccountStatus: customer.customerAccountStatus,
});

export async function issueCustomerClaimToken(
  db: DbClient,
  input: { userId: string; createdById: string; now?: Date },
) {
  const now = input.now ?? new Date();
  const token = randomBytes(32).toString("base64url");

  await db.customerClaimToken.updateMany({
    where: { userId: input.userId, usedAt: null, revokedAt: null },
    data: { revokedAt: now },
  });
  const claimToken = await db.customerClaimToken.create({
    data: {
      userId: input.userId,
      createdById: input.createdById,
      tokenHash: hashCustomerClaimToken(token),
      expiresAt: new Date(now.getTime() + CLAIM_TOKEN_TTL_MS),
    },
    select: { id: true, expiresAt: true },
  });

  return { token, expiresAt: claimToken.expiresAt };
}

export async function createOfflineCustomer(db: DbClient, input: OfflineCustomerInput) {
  const name = input.name?.trim();
  const displayPhone = input.phoneNumber?.trim();
  const normalizedPhoneNumber = displayPhone ? normalizeThaiPhoneNumber(displayPhone) : null;
  const requestedEmail = input.email?.trim().toLowerCase() || null;

  if (!name) throw createError({ statusCode: 400, statusMessage: "กรุณากรอกชื่อลูกค้า" });
  if (name.length > 120) throw createError({ statusCode: 400, statusMessage: "ชื่อลูกค้าต้องไม่เกิน 120 ตัวอักษร" });
  if (displayPhone && displayPhone.length > 30) {
    throw createError({ statusCode: 400, statusMessage: "เบอร์โทรศัพท์ยาวเกินไป" });
  }
  if (!displayPhone || !normalizedPhoneNumber) {
    throw createError({ statusCode: 400, statusMessage: "กรุณากรอกเบอร์โทรศัพท์ไทยให้ถูกต้อง" });
  }
  if (requestedEmail && (requestedEmail.length > 320 || !EMAIL_PATTERN.test(requestedEmail) || isInternalCustomerEmail(requestedEmail))) {
    throw createError({ statusCode: 400, statusMessage: "อีเมลไม่ถูกต้อง" });
  }

  const duplicate = await db.user.findFirst({
    where: { normalizedPhoneNumber, deletedAt: null },
    select: customerSummarySelect,
  });
  if (duplicate) {
    throw createError({
      statusCode: 409,
      statusMessage: duplicate.role === "USER"
        ? "เบอร์โทรหรืออีเมลนี้มีบัญชีลูกค้าอยู่แล้ว"
        : "เบอร์โทรนี้ถูกใช้กับบัญชีผู้ใช้อื่นแล้ว",
      data: duplicate.role === "USER" ? { customer: toSafeCustomerSummary(duplicate) } : undefined,
    });
  }
  if (requestedEmail) {
    const emailOwner = await db.user.findUnique({ where: { email: requestedEmail }, select: { id: true } });
    if (emailOwner) {
      throw createError({ statusCode: 409, statusMessage: "อีเมลนี้มีบัญชีอยู่แล้ว" });
    }
  }

  const customer = await db.user.create({
    data: {
      email: requestedEmail ?? `customer-${randomUUID()}${INTERNAL_EMAIL_DOMAIN}`,
      name,
      phoneNumber: displayPhone,
      normalizedPhoneNumber,
      customerAccountStatus: "OFFLINE",
      createdByStaffId: input.createdByStaffId,
      role: "USER",
      emailVerified: false,
    },
    select: customerSummarySelect,
  });
  const claim = await issueCustomerClaimToken(db, {
    userId: customer.id,
    createdById: input.createdByStaffId,
  });

  return {
    customer: toSafeCustomerSummary(customer),
    activationToken: claim.token,
    activationExpiresAt: claim.expiresAt.toISOString(),
  };
}

export async function resolveOfflineCustomerConflict(error: unknown, input?: Pick<OfflineCustomerInput, "phoneNumber" | "email">) {
  if (!isCustomerUniqueConflict(error) || !input) return null;

  const normalizedPhoneNumber = input.phoneNumber ? normalizeThaiPhoneNumber(input.phoneNumber) : null;
  const email = input.email?.trim().toLowerCase() || null;
  if (!normalizedPhoneNumber && !email) return null;

  const customer = await prisma.user.findFirst({
    where: {
      deletedAt: null,
      OR: [
        ...(normalizedPhoneNumber ? [{ normalizedPhoneNumber }] : []),
        ...(email ? [{ email }] : []),
      ],
    },
    select: customerSummarySelect,
  });
  return customer?.role === "USER" ? toSafeCustomerSummary(customer) : null;
}
