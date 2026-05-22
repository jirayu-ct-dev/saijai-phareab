import { prisma } from "~~/server/utils/prisma";
import { requireUser } from "~~/server/utils/auth";

export default defineEventHandler(async (event) => {
  const actor = requireUser(event);

  const user = await prisma.user.findFirst({
    where: { id: actor.id, deletedAt: null },
    select: {
      id: true,
      email: true,
      name: true,
      image: true,
      phoneNumber: true,
      role: true,
      emailVerified: true,
      createdAt: true,
      accounts: {
        where: { providerId: "line" },
        select: { accountId: true },
        take: 1,
      },
      _count: {
        select: { accounts: { where: { providerId: { not: "line" } } } },
      },
    },
  });

  if (!user) throw createError({ statusCode: 404, statusMessage: "ไม่พบผู้ใช้" });

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    image: user.image,
    phoneNumber: user.phoneNumber,
    role: user.role,
    emailVerified: user.emailVerified,
    createdAt: user.createdAt,
    hasLineLinked: user.accounts.length > 0,
    hasPasswordCredential: user._count.accounts > 0,
  };
});
