import { prisma } from "~~/server/utils/prisma";
import { requireRole } from "~~/server/utils/auth";

export default defineEventHandler(async (event) => {
  requireRole(event, ["ADMIN"]);

  const users = await prisma.user.findMany({
    where: {
      deletedAt: null,
      role: { in: ["ADMIN", "EMPLOYEE"] },
    },
    orderBy: [{ role: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      role: true,
      accounts: {
        where: { providerId: "line" },
        select: { accountId: true },
        take: 1,
      },
    },
  });

  return users.map((user) => ({
    id: user.id,
    name: user.name,
    email: user.email,
    image: user.image,
    role: user.role,
    hasLineLinked: user.accounts.length > 0,
  }));
});
