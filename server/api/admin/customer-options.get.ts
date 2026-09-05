import { prisma } from "~~/server/utils/prisma";
import { requireRole } from "~~/server/utils/auth";
import { isInternalCustomerEmail } from "~~/server/utils/customerAccount";
import { z } from "zod";
import { normalizeThaiPhoneNumber } from "~~/shared/utils/phone";
import { parseBangkokDateTime } from "~~/shared/utils/pickup";
import { backdatedEntitlementWhere } from "~~/server/utils/backdatedEntitlement";

const querySchema = z.object({
  q: z.string().trim().max(100).optional().default(""),
  limit: z.coerce.number().int().min(1).max(50).optional().default(20),
  receivedAt: z.string().optional(),
});

export default defineEventHandler(async (event) => {
  await requireRole(event, ["EMPLOYEE", "ADMIN"]);
  const { q, limit, receivedAt } = await getValidatedQuery(event, querySchema.parse);
  const historicalDate = parseBangkokDateTime(receivedAt);
  if (receivedAt !== undefined && (!historicalDate || Number.isNaN(historicalDate.getTime()) || historicalDate > new Date())) {
    throw createError({ statusCode: 400, statusMessage: "วันรับผ้าย้อนหลังไม่ถูกต้อง" });
  }
  const normalizedPhoneQuery = q ? normalizeThaiPhoneNumber(q) : null;

  try {
    const users = await prisma.user.findMany({
      where: {
        deletedAt: null,
        role: "USER",
        AND: [
          { OR: [{ normalizedPhoneNumber: null }, { NOT: { normalizedPhoneNumber: { startsWith: "000000" } } }] },
          { OR: [{ name: null }, { NOT: { name: { startsWith: "ลูกค้าเดิมไม่ระบุ" } } }] },
        ],
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: "insensitive" as const } },
                { phoneNumber: { contains: q } },
                ...(normalizedPhoneQuery ? [{ normalizedPhoneNumber: { contains: normalizedPhoneQuery } }] : []),
                { email: { contains: q, mode: "insensitive" as const } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        name: true,
        email: true,
        phoneNumber: true,
        image: true,
        customerAccountStatus: true,
        memberEntitlements: {
          where: {
            deletedAt: null,
            status: "ACTIVE",
            ...(historicalDate ? backdatedEntitlementWhere(historicalDate) : {}),
          },
          orderBy: [
            { product: { packageType: "asc" } },
            { endAt: "asc" },
            { createdAt: "desc" },
          ],
          select: {
            id: true,
            creditInitial: true,
            creditRemaining: true,
            endAt: true,
            product: {
              select: {
                id: true,
                name: true,
                packageType: true,
                deductOn: true,
                isDelivery: true,
              },
            },
          },
        },
      },
      orderBy: [
        { name: "asc" },
        { createdAt: "desc" },
      ],
      take: limit,
    });

    return users.map((user) => {
      const activeMemberEntitlement = user.memberEntitlements.find((entitlement) => entitlement.product.packageType === "MAIN") ?? null;
      const activeAddonEntitlements = user.memberEntitlements.filter((entitlement) => entitlement.product.packageType === "ADDON");

      return {
        id: user.id,
        label: `${user.name || user.email}${user.phoneNumber ? ` (${user.phoneNumber})` : ""}`,
        name: user.name,
        email: isInternalCustomerEmail(user.email) ? null : user.email,
        phoneNumber: user.phoneNumber,
        image: user.image,
        customerAccountStatus: user.customerAccountStatus,
        activeMemberEntitlement: activeMemberEntitlement
          ? {
              id: activeMemberEntitlement.id,
              productId: activeMemberEntitlement.product.id,
              productName: activeMemberEntitlement.product.name,
              creditInitial: activeMemberEntitlement.creditInitial,
              creditRemaining: activeMemberEntitlement.creditRemaining,
              endAt: activeMemberEntitlement.endAt?.toISOString() ?? null,
            }
          : null,
        addonEntitlements: activeAddonEntitlements.map((entitlement) => ({
          id: entitlement.id,
          productId: entitlement.product.id,
          productName: entitlement.product.name,
          creditInitial: entitlement.creditInitial,
          creditRemaining: entitlement.creditRemaining,
          endAt: entitlement.endAt?.toISOString() ?? null,
          deductOn: entitlement.product.deductOn,
          isDelivery: entitlement.product.isDelivery,
        })),
      };
    });
  } catch (error) {
    console.error("[GET /api/admin/customer-options]", error);
    throw createError({
      statusCode: 500,
      statusMessage: "ไม่สามารถโหลดรายชื่อลูกค้าได้",
    });
  }
});
