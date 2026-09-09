import { hasActiveMemberPackage } from "~~/server/utils/auth";
import { linkRichMenuToUser } from "~~/server/utils/line-messaging";
import { prisma } from "~~/server/utils/prisma";

type RichMenuKey = "admin" | "employee" | "member" | "user";

const menuEnvByKey: Record<RichMenuKey, string> = {
  admin: "LINE_RICHMENU_ADMIN_ID",
  employee: "LINE_RICHMENU_EMPLOYEE_ID",
  member: "LINE_RICHMENU_MEMBER_ID",
  user: "LINE_RICHMENU_USER_ID",
};

const menuKeyForUser = async (user: { id: string; role: string; isActive: boolean }): Promise<RichMenuKey> => {
  if (!user.isActive) return "user";
  if (user.role === "ADMIN") return "admin";
  if (user.role === "EMPLOYEE") return "employee";
  return (await hasActiveMemberPackage(user.id)) ? "member" : "user";
};

export const syncLineRichMenuForUser = async (userId: string): Promise<boolean> => {
  const user = await prisma.user.findFirst({
    where: { id: userId, deletedAt: null },
    select: {
      id: true,
      role: true,
      isActive: true,
      accounts: {
        where: { providerId: "line" },
        select: { accountId: true },
        take: 1,
      },
    },
  });

  const lineUserId = user?.accounts[0]?.accountId;
  if (!user || !lineUserId) return false;

  const menuKey = await menuKeyForUser(user);
  const richMenuId = process.env[menuEnvByKey[menuKey]]?.trim();
  if (!richMenuId) {
    console.warn(`[LINE rich menu] ${menuEnvByKey[menuKey]} is not configured`);
    return false;
  }

  await linkRichMenuToUser(lineUserId, richMenuId);
  return true;
};
