import { prisma } from "~~/server/utils/prisma";
import { requireRole } from "~~/server/utils/auth";

export default defineEventHandler(async (event) => {
  requireRole(event, ["ADMIN"]);

  const employees = await prisma.user.findMany({
    where: {
      deletedAt: null,
      role: { in: ["ADMIN", "EMPLOYEE"] },
    },
    orderBy: [{ role: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      email: true,
      name: true,
      image: true,
      role: true,
      phoneNumber: true,
      isActive: true,
      createdAt: true,
      accounts: {
        where: { providerId: "line" },
        select: { accountId: true },
        take: 1,
      },
    },
  });

  return employees.map((u) => ({
    id: u.id,
    email: u.email,
    name: u.name,
    image: u.image,
    role: u.role,
    phoneNumber: u.phoneNumber,
    isActive: u.isActive,
    createdAt: u.createdAt,
    hasLineLinked: u.accounts.length > 0,
  }));
});
