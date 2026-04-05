import type { PrismaClient } from "~~/app/generated/prisma/client";

const WALK_IN_EMAIL = "walkin@saijai.local";

export const isWalkInCustomerEmail = (email?: string | null) => email === WALK_IN_EMAIL;

export const getWalkInCustomerEmail = () => WALK_IN_EMAIL;

export const ensureWalkInCustomer = async (prisma: PrismaClient) => {
  return prisma.user.upsert({
    where: { email: WALK_IN_EMAIL },
    update: {
      deletedAt: null,
      deletedById: null,
      role: "USER",
      name: "ลูกค้าหน้าร้าน",
      phoneNumber: null,
      image: null,
    },
    create: {
      email: WALK_IN_EMAIL,
      name: "ลูกค้าหน้าร้าน",
      role: "USER",
      emailVerified: false,
      phoneNumber: null,
      image: null,
    },
    select: {
      id: true,
      email: true,
      name: true,
      phoneNumber: true,
      image: true,
    },
  });
};
