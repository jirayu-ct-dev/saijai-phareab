import type { Prisma } from "~~/app/generated/prisma/client";

// An expired package can record missed usage within its original validity;
// this does not reactivate it or reconstruct previously spent credits.
export const backdatedEntitlementWhere = (receivedAt: Date): Prisma.MemberEntitlementWhereInput => ({
  deletedAt: null,
  status: { in: ["ACTIVE", "EXPIRED"] },
  AND: [
    { OR: [{ startAt: null }, { startAt: { lte: receivedAt } }] },
    { OR: [{ endAt: null }, { endAt: { gte: receivedAt } }] },
    { OR: [{ activatedAt: null }, { activatedAt: { lte: receivedAt } }] },
  ],
});
