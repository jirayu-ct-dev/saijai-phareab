import { requireRole } from "~~/server/utils/auth";
import { prisma } from "~~/server/utils/prisma";

const formatAddress = (address: {
  address: string | null;
  subdistrict: string | null;
  district: string | null;
  province: string | null;
  postalCode: string | null;
} | undefined) => {
  if (!address) return null;
  const locality = [address.subdistrict, address.district, address.province, address.postalCode]
    .filter(Boolean)
    .join(" ");
  return [address.address, locality].filter(Boolean).join(" · ") || null;
};

export default defineEventHandler(async (event) => {
  await requireRole(event, ["EMPLOYEE", "ADMIN"]);

  const confirmations = await prisma.pickupConfirmation.findMany({
    where: {
      serviceOrder: {
        deletedAt: null,
      },
    },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      revision: true,
      status: true,
      response: true,
      respondedAt: true,
      responseCount: true,
      dueAtSnapshot: true,
      updatedAt: true,
      serviceOrder: {
        select: {
          id: true,
          orderNo: true,
          status: true,
          dueAt: true,
          isWalkIn: true,
          walkInName: true,
          walkInPhone: true,
          customer: {
            select: {
              id: true,
              name: true,
              email: true,
              phoneNumber: true,
              image: true,
              accounts: {
                where: { providerId: "line" },
                select: { accountId: true },
                take: 1,
              },
              userAddresses: {
                where: { deletedAt: null },
                orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
                select: {
                  address: true,
                  subdistrict: true,
                  district: true,
                  province: true,
                  postalCode: true,
                },
                take: 1,
              },
            },
          },
        },
      },
      notifications: {
        where: { kind: "INITIAL" },
        orderBy: [{ revision: "desc" }, { createdAt: "desc" }],
        select: {
          status: true,
          scheduledFor: true,
          sentAt: true,
        },
        take: 1,
      },
      responseEvents: {
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        select: {
          id: true,
          response: true,
          createdAt: true,
          staffNotifiedAt: true,
          staffNotifyAttempts: true,
          staffNotifyError: true,
        },
        take: 1,
      },
    },
  });

  return confirmations.map((confirmation) => {
    const order = confirmation.serviceOrder;
    const customer = order.customer;
    const latestResponse = confirmation.responseEvents[0] ?? null;
    const initialNotification = confirmation.notifications[0] ?? null;

    return {
      id: confirmation.id,
      revision: confirmation.revision,
      status: confirmation.status,
      response: confirmation.response,
      respondedAt: confirmation.respondedAt?.toISOString() ?? null,
      responseCount: confirmation.responseCount,
      dueAt: (confirmation.dueAtSnapshot ?? order.dueAt)?.toISOString() ?? null,
      updatedAt: confirmation.updatedAt.toISOString(),
      order: {
        id: order.id,
        orderNo: order.orderNo,
        status: order.status,
      },
      customer: {
        id: customer.id,
        name: order.isWalkIn ? order.walkInName || "ลูกค้าหน้าร้าน" : customer.name || "ไม่ระบุชื่อ",
        email: customer.email,
        phoneNumber: order.isWalkIn ? order.walkInPhone : customer.phoneNumber,
        image: order.isWalkIn ? null : customer.image,
        lineUserId: order.isWalkIn ? null : customer.accounts[0]?.accountId ?? null,
        address: order.isWalkIn ? null : formatAddress(customer.userAddresses[0]),
      },
      initialNotification: initialNotification
        ? {
            status: initialNotification.status,
            scheduledFor: initialNotification.scheduledFor.toISOString(),
            sentAt: initialNotification.sentAt?.toISOString() ?? null,
          }
        : null,
      latestResponse: latestResponse
        ? {
            id: latestResponse.id,
            response: latestResponse.response,
            createdAt: latestResponse.createdAt.toISOString(),
            staffNotifiedAt: latestResponse.staffNotifiedAt?.toISOString() ?? null,
            staffNotifyAttempts: latestResponse.staffNotifyAttempts,
            staffNotifyError: latestResponse.staffNotifyError,
          }
        : null,
    };
  });
});
