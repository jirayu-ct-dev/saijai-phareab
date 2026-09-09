import { createHash } from "node:crypto";
import { hasActiveMemberPackage } from "~~/server/utils/auth";
import {
  getRichMenuForUser,
  linkRichMenuToUser,
  unlinkRichMenuFromUser,
} from "~~/server/utils/line-messaging";
import { prisma } from "~~/server/utils/prisma";

export type RichMenuKey = "admin" | "employee" | "member" | "user";

export type RichMenuSyncResult = {
  linked: boolean;
  menuKey?: RichMenuKey;
  expectedRichMenuId?: string;
  actualRichMenuId?: string | null;
  reason?: "USER_NOT_FOUND" | "LINE_NOT_LINKED" | "RICH_MENU_NOT_CONFIGURED" | "VERIFY_NOT_LINKED";
};

const menuEnvByKey: Record<RichMenuKey, string> = {
  admin: "LINE_RICHMENU_ADMIN_ID",
  employee: "LINE_RICHMENU_EMPLOYEE_ID",
  member: "LINE_RICHMENU_MEMBER_ID",
  user: "LINE_RICHMENU_USER_ID",
};

const identifierHash = (value: string): string => createHash("sha256").update(value).digest("hex").slice(0, 12);

const menuKeyForUser = async (user: { id: string; role: string; isActive: boolean }): Promise<RichMenuKey> => {
  if (!user.isActive) return "user";
  if (user.role === "ADMIN") return "admin";
  if (user.role === "EMPLOYEE") return "employee";
  return (await hasActiveMemberPackage(user.id)) ? "member" : "user";
};

export const syncLineRichMenuForUser = async (userId: string): Promise<RichMenuSyncResult> => {
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
  if (!user) return { linked: false, reason: "USER_NOT_FOUND" };
  if (!lineUserId) return { linked: false, reason: "LINE_NOT_LINKED" };

  const menuKey = await menuKeyForUser(user);
  const richMenuId = process.env[menuEnvByKey[menuKey]]?.trim();
  if (!richMenuId) {
    console.warn(`[LINE rich menu] ${menuEnvByKey[menuKey]} is not configured`);
    return { linked: false, menuKey, reason: "RICH_MENU_NOT_CONFIGURED" };
  }

  const linkResult = await linkRichMenuToUser(lineUserId, richMenuId);
  const lookupResult = await getRichMenuForUser(lineUserId);
  if (lookupResult.richMenuId !== richMenuId) {
    console.warn("[LINE rich menu] link verification failed", {
      userHash: identifierHash(user.id),
      lineUserHash: identifierHash(lineUserId),
      role: user.role,
      menuKey,
      expectedRichMenuId: richMenuId,
      actualRichMenuId: lookupResult.richMenuId,
      postStatus: linkResult.status,
      verificationStatus: lookupResult.status,
    });
    return {
      linked: false,
      menuKey,
      expectedRichMenuId: richMenuId,
      actualRichMenuId: lookupResult.richMenuId,
      reason: "VERIFY_NOT_LINKED",
    };
  }

  return {
    linked: true,
    menuKey,
    expectedRichMenuId: richMenuId,
    actualRichMenuId: lookupResult.richMenuId,
  };
};

export const unlinkLineRichMenuForUser = async (userId: string): Promise<boolean> => {
  const user = await prisma.user.findFirst({
    where: { id: userId },
    select: {
      accounts: {
        where: { providerId: "line" },
        select: { accountId: true },
        take: 1,
      },
    },
  });

  const lineUserId = user?.accounts[0]?.accountId;
  if (!lineUserId) return false;

  await unlinkRichMenuFromUser(lineUserId);
  return true;
};
