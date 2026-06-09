import { prisma } from "~~/server/utils/prisma";
import { pushMessage, type LineMessage } from "~~/server/utils/line-messaging";

const DEFAULT_THRESHOLDS = [7, 3, 1];

const parseThresholds = (raw: string | undefined): number[] => {
  if (!raw) return DEFAULT_THRESHOLDS;
  const parsed = raw
    .split(",")
    .map((s) => Number.parseInt(s.trim(), 10))
    .filter((n) => Number.isFinite(n) && n > 0);
  const unique = Array.from(new Set(parsed)).sort((a, b) => b - a);
  return unique.length > 0 ? unique : DEFAULT_THRESHOLDS;
};

const startOfBangkokDay = (d: Date): Date => {
  // Bangkok = UTC+7. Find the UTC instant that corresponds to local 00:00.
  const bangkokMs = d.getTime() + 7 * 60 * 60 * 1000;
  const dayStart = Math.floor(bangkokMs / (24 * 60 * 60 * 1000)) * (24 * 60 * 60 * 1000);
  return new Date(dayStart - 7 * 60 * 60 * 1000);
};

const formatBangkokDate = (d: Date): string => {
  const local = new Date(d.getTime() + 7 * 60 * 60 * 1000);
  const dd = String(local.getUTCDate()).padStart(2, "0");
  const mm = String(local.getUTCMonth() + 1).padStart(2, "0");
  const yyyy = local.getUTCFullYear() + 543; // Buddhist Era
  return `${dd}/${mm}/${yyyy}`;
};

const getLineUserId = async (userId: string): Promise<string | null> => {
  const account = await prisma.account.findFirst({
    where: { userId, providerId: "line" },
    select: { accountId: true },
  });
  return account?.accountId ?? null;
};

const getShopName = async (): Promise<string> => {
  const shop = await prisma.shopSetting.findUnique({ where: { id: "singleton" } });
  return shop?.name?.trim() || "ร้านซักผ้า";
};

const getBaseUrl = (): string =>
  process.env.BETTER_AUTH_URL?.trim() ||
  process.env.NUXT_PUBLIC_BASE_URL?.trim() ||
  "http://localhost:3000";

type ExpiringEntitlement = {
  id: string;
  customerId: string;
  endAt: Date;
  productName: string;
  creditRemaining: number | null;
};

const buildFlex = (
  shopName: string,
  e: ExpiringEntitlement,
  daysBefore: number,
): LineMessage => {
  const headline =
    daysBefore <= 0
      ? "แพ็กเกจของคุณหมดอายุวันนี้"
      : `แพ็กเกจของคุณกำลังจะหมดอายุในอีก ${daysBefore} วัน`;
  const expiryText = formatBangkokDate(e.endAt);
  const url = `${getBaseUrl()}/packages`;

  const bodyContents: Record<string, unknown>[] = [
    {
      type: "box",
      layout: "horizontal",
      spacing: "sm",
      contents: [
        { type: "text", text: "แพ็กเกจ", size: "sm", color: "#6B7280", flex: 3 },
        { type: "text", text: e.productName, size: "sm", color: "#111827", flex: 5, align: "end", wrap: true },
      ],
    },
    {
      type: "box",
      layout: "horizontal",
      spacing: "sm",
      contents: [
        { type: "text", text: "วันหมดอายุ", size: "sm", color: "#6B7280", flex: 3 },
        { type: "text", text: expiryText, size: "sm", color: "#DC2626", flex: 5, align: "end", weight: "bold" },
      ],
    },
  ];

  if (typeof e.creditRemaining === "number") {
    bodyContents.push({
      type: "box",
      layout: "horizontal",
      spacing: "sm",
      contents: [
        { type: "text", text: "เครดิตคงเหลือ", size: "sm", color: "#6B7280", flex: 3 },
        { type: "text", text: `${e.creditRemaining} เครดิต`, size: "sm", color: "#111827", flex: 5, align: "end" },
      ],
    });
  }

  bodyContents.push({
    type: "text",
    text: "กรุณาต่ออายุเพื่อใช้บริการต่อเนื่อง",
    size: "xs",
    color: "#6B7280",
    margin: "md",
    wrap: true,
  });

  return {
    type: "flex",
    altText: headline,
    contents: {
      type: "bubble",
      size: "mega",
      header: {
        type: "box",
        layout: "vertical",
        backgroundColor: "#DC2626",
        paddingAll: "14px",
        contents: [
          { type: "text", text: shopName, color: "#FFFFFFCC", size: "xs", weight: "bold" },
          { type: "text", text: `⏰ ${headline}`, color: "#FFFFFF", size: "lg", weight: "bold", margin: "sm", wrap: true },
        ],
      },
      body: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        paddingAll: "16px",
        contents: bodyContents,
      },
      footer: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "button",
            style: "primary",
            color: "#DC2626",
            action: { type: "uri", label: "ดูแพ็กเกจของฉัน", uri: url },
          },
        ],
      },
    },
  };
};

const sendWithRetry = async (lineUserId: string, msg: LineMessage, attempts = 2): Promise<boolean> => {
  for (let i = 0; i < attempts; i++) {
    try {
      await pushMessage({ to: lineUserId, messages: [msg] });
      return true;
    } catch (error) {
      console.error("[notifyExpiring] LINE push failed", { lineUserId, attempt: i + 1, error });
      if (i === attempts - 1) return false;
      await new Promise((r) => setTimeout(r, 500 * (i + 1)));
    }
  }
  return false;
};

export type RunResult = {
  threshold: number;
  scanned: number;
  sent: number;
  skippedDuplicate: number;
  skippedNoLine: number;
  skippedOptedOut: number;
  failed: number;
};

export const runExpiringPackageNotifications = async (
  now: Date = new Date(),
): Promise<RunResult[]> => {
  const setting = await prisma.notificationSetting.findUnique({ where: { id: "singleton" } });
  if (setting && setting.notifyCustomerOnPackageExpiring === false) {
    console.info("[notifyExpiring] disabled by NotificationSetting");
    return [];
  }

  const thresholds = parseThresholds(process.env.PACKAGE_EXPIRY_NOTIFY_DAYS);
  const shopName = await getShopName();
  const results: RunResult[] = [];

  const todayStart = startOfBangkokDay(now);

  for (const days of thresholds) {
    const windowStart = new Date(todayStart.getTime() + days * 86400000);
    const windowEnd = new Date(windowStart.getTime() + 86400000);

    const entitlements = await prisma.memberEntitlement.findMany({
      where: {
        deletedAt: null,
        status: "ACTIVE",
        endAt: { gte: windowStart, lt: windowEnd },
      },
      select: {
        id: true,
        customerId: true,
        endAt: true,
        creditRemaining: true,
        product: { select: { name: true } },
        customer: { select: { id: true, lineNotifyEnabled: true, deletedAt: true } },
      },
    });

    const result: RunResult = {
      threshold: days,
      scanned: entitlements.length,
      sent: 0,
      skippedDuplicate: 0,
      skippedNoLine: 0,
      skippedOptedOut: 0,
      failed: 0,
    };

    for (const ent of entitlements) {
      if (!ent.endAt) continue;
      if (!ent.customer || ent.customer.deletedAt) continue;
      if (!ent.customer.lineNotifyEnabled) {
        result.skippedOptedOut++;
        continue;
      }

      const endAtDay = new Date(
        Date.UTC(ent.endAt.getUTCFullYear(), ent.endAt.getUTCMonth(), ent.endAt.getUTCDate()),
      );
      const existing = await prisma.packageExpiryNotification.findUnique({
        where: {
          entitlementId_daysBefore_endAtSnapshot: {
            entitlementId: ent.id,
            daysBefore: days,
            endAtSnapshot: endAtDay,
          },
        },
        select: { id: true },
      });
      if (existing) {
        result.skippedDuplicate++;
        continue;
      }

      const lineUserId = await getLineUserId(ent.customerId);
      if (!lineUserId) {
        result.skippedNoLine++;
        continue;
      }

      const flex = buildFlex(
        shopName,
        {
          id: ent.id,
          customerId: ent.customerId,
          endAt: ent.endAt,
          productName: ent.product?.name ?? "แพ็กเกจ",
          creditRemaining: ent.creditRemaining,
        },
        days,
      );

      const ok = await sendWithRetry(lineUserId, flex);
      if (!ok) {
        result.failed++;
        continue;
      }

      try {
        await prisma.packageExpiryNotification.create({
          data: {
            entitlementId: ent.id,
            daysBefore: days,
            endAtSnapshot: endAtDay,
          },
        });
        result.sent++;
      } catch (error) {
        // Race: another process logged it. Treat as duplicate.
        console.warn("[notifyExpiring] log race", { entitlementId: ent.id, days, error });
        result.skippedDuplicate++;
      }
    }

    results.push(result);
  }

  console.info("[notifyExpiring] run summary", { results });
  return results;
};
