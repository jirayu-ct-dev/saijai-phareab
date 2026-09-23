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
            ...(historicalDate
              ? backdatedEntitlementWhere(historicalDate)
              : { OR: [{ endAt: null }, { endAt: { gte: new Date() } }] }),
            status: "ACTIVE",
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
            startAt: true,
            endAt: true,
            product: {
              select: {
                id: true,
                name: true,
                packageType: true,
                deductOn: true,
                isDelivery: true,
                serviceId: true,
                service: {
                  select: {
                    name: true,
                    includedItems: { select: { storefrontItemId: true } },
                  },
                },
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
      const mainEntitlements = user.memberEntitlements.filter((entitlement) => entitlement.product.packageType === "MAIN");
      const activeAddonEntitlements = user.memberEntitlements.filter((entitlement) => entitlement.product.packageType === "ADDON");

      const sortedMainEntitlements = [...mainEntitlements].sort((a, b) => {
        const aHasCredit = (a.creditRemaining ?? 0) > 0 ? 1 : 0;
        const bHasCredit = (b.creditRemaining ?? 0) > 0 ? 1 : 0;
        if (aHasCredit !== bHasCredit) return bHasCredit - aHasCredit;

        if (aHasCredit) {
          const aEnd = a.endAt ? new Date(a.endAt).getTime() : Infinity;
          const bEnd = b.endAt ? new Date(b.endAt).getTime() : Infinity;
          return aEnd - bEnd;
        }

        const aEnd = a.endAt ? new Date(a.endAt).getTime() : 0;
        const bEnd = b.endAt ? new Date(b.endAt).getTime() : 0;
        return bEnd - aEnd;
      });

      const activeMemberEntitlement = sortedMainEntitlements[0] ?? null;

      return {
        id: user.id,
        label: `${user.name || user.email}${user.phoneNumber ? ` (${user.phoneNumber})` : ""}`,
        name: user.name,
        email: isInternalCustomerEmail(user.email) ? null : user.email,
        phoneNumber: user.phoneNumber,
        image: user.image,
        customerAccountStatus: user.customerAccountStatus,
        memberEntitlementOptions: sortedMainEntitlements
          .map((entitlement) => ({
            id: entitlement.id,
            productId: entitlement.product.id,
            productName: entitlement.product.name,
            creditInitial: entitlement.creditInitial,
            creditRemaining: entitlement.creditRemaining,
            startAt: entitlement.startAt?.toISOString() ?? null,
            endAt: entitlement.endAt?.toISOString() ?? null,
            serviceId: entitlement.product.serviceId,
            serviceName: entitlement.product.service?.name ?? null,
            includedItemIds: entitlement.product.service?.includedItems.map((item) => item.storefrontItemId) ?? [],
          })),
        activeMemberEntitlement: activeMemberEntitlement
          ? {
              id: activeMemberEntitlement.id,
              productId: activeMemberEntitlement.product.id,
              productName: activeMemberEntitlement.product.name,
              creditInitial: activeMemberEntitlement.creditInitial,
              creditRemaining: activeMemberEntitlement.creditRemaining,
              startAt: activeMemberEntitlement.startAt?.toISOString() ?? null,
              endAt: activeMemberEntitlement.endAt?.toISOString() ?? null,
              serviceId: activeMemberEntitlement.product.serviceId,
              serviceName: activeMemberEntitlement.product.service?.name ?? null,
              includedItemIds: activeMemberEntitlement.product.service?.includedItems.map((item) => item.storefrontItemId) ?? [],
            }
          : null,
        addonEntitlements: activeAddonEntitlements.map((entitlement) => ({
          id: entitlement.id,
          productId: entitlement.product.id,
          productName: entitlement.product.name,
          creditInitial: entitlement.creditInitial,
          creditRemaining: entitlement.creditRemaining,
          startAt: entitlement.startAt?.toISOString() ?? null,
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
