import { prisma } from "~~/server/utils/prisma";
import { requireRole } from "~~/server/utils/auth";

export default defineEventHandler(async (event) => {
  requireRole(event, ["ADMIN", "EMPLOYEE"]);

  const setting = await prisma.shopSetting.upsert({
    where: { id: "singleton" },
    create: { id: "singleton" },
    update: {},
  });

  return setting;
});
