import { prisma } from "~~/server/utils/prisma";
import { pushMessage, type LineMessage } from "~~/server/utils/line-messaging";
import type { ServiceOrderStatus } from "~~/shared/types/enums";
import { formatDate, formatDateTime } from "~~/shared/utils/format";

export const serviceOrderStatusLabels: Record<ServiceOrderStatus, string> = {
  RECEIVED: "รับผ้าแล้ว",
  PROCESSING: "กำลังซัก",
  DELIVERING: "พร้อมส่ง / กำลังจัดส่ง",
  COMPLETED: "ส่งผ้าเรียบร้อย",
  CANCELLED: "ยกเลิก",
};

const customerHeadline: Record<ServiceOrderStatus, string> = {
  RECEIVED: "รับผ้าจากคุณเรียบร้อยแล้ว",
  PROCESSING: "เริ่มซักผ้าให้คุณแล้ว",
  DELIVERING: "ผ้าพร้อมส่งให้คุณแล้ว",
  COMPLETED: "ส่งผ้าเรียบร้อย ขอบคุณที่ใช้บริการ",
  CANCELLED: "ออเดอร์นี้ถูกยกเลิกแล้ว",
};

const staffHeadline = (status: ServiceOrderStatus, customerName: string): string => {
  const c = customerName || "ลูกค้า";
  switch (status) {
    case "RECEIVED":
      return `รับผ้าจากคุณ ${c} เรียบร้อยแล้ว`;
    case "PROCESSING":
      return `เริ่มซักผ้าให้คุณ ${c} แล้ว`;
    case "DELIVERING":
      return `ผ้าของคุณ ${c} พร้อมส่งแล้ว`;
    case "COMPLETED":
      return `ส่งผ้าให้คุณ ${c} เรียบร้อยแล้ว`;
    case "CANCELLED":
      return `ออเดอร์ของคุณ ${c} ถูกยกเลิก`;
  }
};

const customerSubline = (status: ServiceOrderStatus): string | null => {
  if (status === "DELIVERING") return "พร้อมให้คุณมารับ หรือกำลังจัดส่งให้แล้ว";
  if (status === "PROCESSING") return "ทีมงานกำลังดูแลผ้าของคุณอย่างดี";
  return null;
};

const staffSubline = (status: ServiceOrderStatus): string | null => {
  if (status === "RECEIVED") return "มีออเดอร์ใหม่เข้าระบบ";
  if (status === "DELIVERING") return "ผ้าพร้อมส่ง / ลูกค้ามารับได้แล้ว";
  if (status === "COMPLETED") return "ปิดงานเรียบร้อย";
  if (status === "CANCELLED") return "ออเดอร์ถูกยกเลิก";
  return null;
};

const statusEmoji: Record<ServiceOrderStatus, string> = {
  RECEIVED: "🧺",
  PROCESSING: "💧",
  DELIVERING: "🛵",
  COMPLETED: "✅",
  CANCELLED: "❌",
};

const statusColors: Record<ServiceOrderStatus, string> = {
  RECEIVED: "#2563EB",
  PROCESSING: "#F59E0B",
  DELIVERING: "#8B5CF6",
  COMPLETED: "#16A34A",
  CANCELLED: "#DC2626",
};

const getBaseUrl = (): string => {
  return (
    process.env.BETTER_AUTH_URL?.trim() ||
    process.env.NUXT_PUBLIC_BASE_URL?.trim() ||
    "http://localhost:3000"
  );
};

const getLineUserId = async (userId: string): Promise<string | null> => {
  const account = await prisma.account.findFirst({
    where: { userId, providerId: "line" },
    select: { accountId: true },
  });
  return account?.accountId ?? null;
};

const getNotificationSetting = async () => {
  const existing = await prisma.notificationSetting.findUnique({ where: { id: "singleton" } });
  if (existing) return existing;
  return prisma.notificationSetting.upsert({
    where: { id: "singleton" },
    create: { id: "singleton" },
    update: {},
  });
};

const chunkMessages = (messages: LineMessage[], size = 5): LineMessage[][] => {
  if (messages.length === 0) return [];
  const chunks: LineMessage[][] = [];
  for (let i = 0; i < messages.length; i += size) {
    chunks.push(messages.slice(i, i + size));
  }
  return chunks;
};

const safePush = async (lineUserId: string, messages: LineMessage[]): Promise<void> => {
  for (const chunk of chunkMessages(messages, 5)) {
    try {
      await pushMessage({ to: lineUserId, messages: chunk });
    } catch (error) {
      console.error("[notify] LINE push failed", { lineUserId, error });
      return;
    }
  }
};

const pushToCustomer = async (customerId: string, messages: LineMessage[]): Promise<void> => {
  const customer = await prisma.user.findFirst({
    where: { id: customerId, deletedAt: null },
    select: { id: true, lineNotifyEnabled: true },
  });
  if (!customer || !customer.lineNotifyEnabled) return;

  const lineUserId = await getLineUserId(customer.id);
  if (!lineUserId) return;

  await safePush(lineUserId, messages);
};

const pushToSubscribers = async (
  channel: "receiveNewOrder" | "receiveStatusChange" | "receiveReceipt",
  messages: LineMessage[],
): Promise<void> => {
  const subscribers = await prisma.notificationSubscriber.findMany({
    where: { isActive: true, [channel]: true },
    select: { userId: true },
  });

  await Promise.all(
    subscribers.map(async (sub) => {
      const lineUserId = await getLineUserId(sub.userId);
      if (!lineUserId) return;
      await safePush(lineUserId, messages);
    }),
  );
};

const formatCurrency = (n: number): string =>
  new Intl.NumberFormat("th-TH", { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(n);

const cloudinaryPreview = (url: string): string => {
  if (!url.includes("/upload/")) return url;
  return url.replace("/upload/", "/upload/c_fill,w_320,q_auto/");
};

const buildImageMessage = (secureUrl: string): LineMessage => ({
  type: "image",
  originalContentUrl: secureUrl,
  previewImageUrl: cloudinaryPreview(secureUrl),
});

const buildTextMessage = (text: string): LineMessage => ({ type: "text", text });

type FlexBox = Record<string, unknown>;

const kvRow = (label: string, value: string): FlexBox => ({
  type: "box",
  layout: "horizontal",
  spacing: "sm",
  contents: [
    { type: "text", text: label, size: "sm", color: "#6B7280", flex: 3 },
    { type: "text", text: value, size: "sm", color: "#111827", flex: 5, align: "end", wrap: true },
  ],
});

const itemRow = (name: string, qty: number, total: number, isPackage: boolean): FlexBox => ({
  type: "box",
  layout: "horizontal",
  spacing: "sm",
  contents: [
    { type: "text", text: `• ${name}`, size: "sm", color: "#111827", flex: 5, wrap: true },
    { type: "text", text: `x${qty}`, size: "sm", color: "#6B7280", flex: 1, align: "end" },
    {
      type: "text",
      text: isPackage ? "ใช้แพ็กเกจ" : `฿${formatCurrency(total)}`,
      size: "sm",
      color: isPackage ? "#16A34A" : "#111827",
      flex: 3,
      align: "end",
    },
  ],
});

const sectionHeading = (text: string): FlexBox => ({
  type: "text",
  text,
  size: "xs",
  weight: "bold",
  color: "#6B7280",
  margin: "md",
});

const divider = (): FlexBox => ({ type: "separator", margin: "md" });

type FlexBubbleParams = {
  shopName: string;
  emoji: string;
  headline: string;
  subline?: string | null;
  bodyContents: FlexBox[];
  buttonLabel: string;
  buttonUrl: string;
  color: string;
  altText: string;
  size?: "kilo" | "mega" | "giga";
};

const buildFlexBubble = (p: FlexBubbleParams): LineMessage => ({
  type: "flex",
  altText: p.altText,
  contents: {
    type: "bubble",
    size: p.size ?? "mega",
    header: {
      type: "box",
      layout: "vertical",
      backgroundColor: p.color,
      paddingAll: "14px",
      contents: [
        { type: "text", text: p.shopName, color: "#FFFFFFCC", size: "xs", weight: "bold" },
        {
          type: "text",
          text: `${p.emoji} ${p.headline}`,
          color: "#FFFFFF",
          size: "lg",
          weight: "bold",
          margin: "sm",
          wrap: true,
        },
        ...(p.subline
          ? [{ type: "text", text: p.subline, color: "#FFFFFFCC", size: "xs", margin: "xs", wrap: true }]
          : []),
      ],
    },
    body: {
      type: "box",
      layout: "vertical",
      spacing: "sm",
      paddingAll: "16px",
      contents: p.bodyContents,
    },
    footer: {
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "button",
          style: "primary",
          color: p.color,
          action: { type: "uri", label: p.buttonLabel, uri: p.buttonUrl },
        },
      ],
    },
  },
});

const getShopName = async (): Promise<string> => {
  const shop = await prisma.shopSetting.findUnique({ where: { id: "singleton" } });
  return shop?.name?.trim() || "ร้านซักผ้า";
};

type StatusToggleField =
  | "notifyCustomerOnReceived"
  | "notifyCustomerOnProcessing"
  | "notifyCustomerOnDelivering"
  | "notifyCustomerOnCompleted"
  | "notifyCustomerOnCancelled";

const statusToggleMap: Record<ServiceOrderStatus, StatusToggleField> = {
  RECEIVED: "notifyCustomerOnReceived",
  PROCESSING: "notifyCustomerOnProcessing",
  DELIVERING: "notifyCustomerOnDelivering",
  COMPLETED: "notifyCustomerOnCompleted",
  CANCELLED: "notifyCustomerOnCancelled",
};

const collectImageUrls = (urls: Array<string | null | undefined>, max: number): string[] => {
  const out: string[] = [];
  for (const url of urls) {
    if (!url) continue;
    if (out.includes(url)) continue;
    out.push(url);
    if (out.length >= max) break;
  }
  return out;
};

const loadServiceOrderForNotify = async (id: string) =>
  prisma.serviceOrder.findFirst({
    where: { id, deletedAt: null },
    select: {
      id: true,
      orderNo: true,
      status: true,
      receivedAt: true,
      dueAt: true,
      updatedAt: true,
      creditUsed: true,
      customerId: true,
      subtotalAmount: true,
      discountAmount: true,
      totalAmount: true,
      hangerCharge: true,
      note: true,
      customer: { select: { name: true, email: true } },
      image: { select: { secureUrl: true, url: true } },
      deliveryImage: { select: { secureUrl: true, url: true } },
      memberEntitlement: {
        select: {
          creditInitial: true,
          creditRemaining: true,
          endAt: true,
          product: { select: { name: true } },
        },
      },
      serviceOrderItems: {
        where: { deletedAt: null },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          quantity: true,
          unitPrice: true,
          totalPrice: true,
          isPackageIncluded: true,
          notes: true,
          storefrontPrice: {
            select: {
              storefrontItem: { select: { name: true } },
              storefrontService: { select: { name: true } },
            },
          },
          photos: {
            where: { deletedAt: null, isDamaged: true },
            orderBy: { sortOrder: "asc" },
            select: { image: { select: { secureUrl: true, url: true } } },
          },
        },
      },
      payments: {
        where: { deletedAt: null },
        orderBy: { createdAt: "asc" },
        select: { id: true, paidAt: true, metadata: true },
      },
    },
  });

type LoadedServiceOrder = NonNullable<Awaited<ReturnType<typeof loadServiceOrderForNotify>>>;

type UsageHistoryRow = {
  sessionIndex: number;
  receivedAt: string;
  quantity: number;
  isCurrent: boolean;
};

const loadUsageHistory = async (
  memberEntitlementId: string,
  currentOrderId: string,
): Promise<UsageHistoryRow[]> => {
  const orders = await prisma.serviceOrder.findMany({
    where: { memberEntitlementId, deletedAt: null },
    orderBy: { receivedAt: "asc" },
    select: {
      id: true,
      receivedAt: true,
      serviceOrderItems: {
        where: { deletedAt: null, isPackageIncluded: true },
        select: { quantity: true },
      },
    },
  });

  return orders.map((row, index) => ({
    sessionIndex: index + 1,
    receivedAt: row.receivedAt.toISOString(),
    quantity: row.serviceOrderItems.reduce((sum, it) => sum + it.quantity, 0),
    isCurrent: row.id === currentOrderId,
  }));
};

const buildOrderBody = async (params: {
  order: LoadedServiceOrder;
  status: ServiceOrderStatus;
  customerName: string;
  totalQty: number;
  detailed: boolean;
}): Promise<FlexBox[]> => {
  const { order, status, customerName, totalQty, detailed } = params;
  const orderNo = order.orderNo || `ORDER-${order.id.slice(-8).toUpperCase()}`;
  const isPackage = Boolean(order.memberEntitlement);
  const rows: FlexBox[] = [
    kvRow("เลขรับผ้า", orderNo),
    kvRow("ชื่อลูกค้า", customerName),
    kvRow("รูปแบบบริการ", isPackage ? "แพ็กเกจรายเดือน" : "ราคาหน้าร้าน"),
    kvRow("วันที่รับผ้า", formatDateTime(order.receivedAt.toISOString())),
  ];

  if (status === "RECEIVED" || status === "PROCESSING" || status === "DELIVERING") {
    rows.push(kvRow("นัดรับ", order.dueAt ? formatDateTime(order.dueAt.toISOString()) : "ไม่ระบุ"));
  }

  if (status === "COMPLETED") {
    rows.push(kvRow("วันที่ส่งผ้า", formatDateTime(order.updatedAt.toISOString())));
  }

  rows.push(kvRow("จำนวนผ้า", `${totalQty} ชิ้น`));

  if (detailed) {
    rows.push(divider());
    rows.push(sectionHeading("รายการบริการ"));
    for (const item of order.serviceOrderItems) {
      const itemName = item.storefrontPrice.storefrontItem.name;
      const serviceName = item.storefrontPrice.storefrontService.name;
      rows.push(
        itemRow(`${itemName} (${serviceName})`, item.quantity, Number(item.totalPrice), item.isPackageIncluded),
      );
    }

    const subtotal = Number(order.subtotalAmount);
    const discount = Number(order.discountAmount);
    const hanger = (order.hangerCharge ?? null) as { count?: number; total?: number } | null;
    const hangerTotal = Number(hanger?.total ?? 0);
    const hangerCount = Number(hanger?.count ?? 0);
    const totalAmount = order.totalAmount != null ? Number(order.totalAmount) : subtotal - discount + hangerTotal;

    rows.push(divider());
    rows.push(kvRow("ราคารวม", `฿${formatCurrency(subtotal)}`));
    if (hangerTotal > 0) {
      rows.push(kvRow("ค่าไม้แขวน", `${hangerCount} ชิ้น  ฿${formatCurrency(hangerTotal)}`));
    }
    if (discount > 0) {
      rows.push(kvRow("ส่วนลด", `- ฿${formatCurrency(discount)}`));
    }

    const paymentMeta = (order.payments[0]?.metadata ?? null) as { vat?: { rate?: number; amount?: number; included?: boolean } } | null;
    const vat = paymentMeta?.vat;
    if (vat && Number(vat.rate ?? 0) > 0) {
      const vatAmount = Number(vat.amount ?? 0);
      const label = vat.included ? `รวม VAT ${vat.rate}%` : `VAT ${vat.rate}%`;
      rows.push(kvRow(label, `฿${formatCurrency(vatAmount)}`));
    }

    rows.push(kvRow("ยอดสุทธิ", `฿${formatCurrency(totalAmount)}`));

    if (order.note) {
      rows.push(divider());
      rows.push(sectionHeading("หมายเหตุ"));
      rows.push({ type: "text", text: order.note, size: "sm", color: "#374151", wrap: true });
    }
  }

  const entitlement = order.memberEntitlement;
  if (entitlement) {
    rows.push(divider());
    rows.push(sectionHeading("แพ็กเกจรายเดือน"));
    rows.push(kvRow("แพ็กเกจ", entitlement.product.name));
    if ((order.creditUsed ?? 0) > 0) {
      rows.push(kvRow("ใช้เครดิตครั้งนี้", `${order.creditUsed} เครดิต`));
    }
    rows.push(
      kvRow("คงเหลือ", `${entitlement.creditRemaining ?? 0}/${entitlement.creditInitial ?? 0} เครดิต`),
    );
    if (entitlement.endAt) {
      rows.push(kvRow("หมดอายุ", formatDate(entitlement.endAt.toISOString())));
    }

    if (detailed) {
      const memberEntitlementId = await (async () => {
        const found = await prisma.serviceOrder.findUnique({
          where: { id: order.id },
          select: { memberEntitlementId: true },
        });
        return found?.memberEntitlementId ?? null;
      })();
      if (memberEntitlementId) {
        const history = await loadUsageHistory(memberEntitlementId, order.id);
        if (history.length) {
          rows.push(divider());
          rows.push(sectionHeading("ประวัติการใช้บริการ"));
          rows.push({
            type: "box",
            layout: "horizontal",
            spacing: "sm",
            contents: [
              { type: "text", text: "ครั้งที่", size: "xs", color: "#6B7280", flex: 1, weight: "bold" },
              { type: "text", text: "วันที่", size: "xs", color: "#6B7280", flex: 4, weight: "bold" },
              { type: "text", text: "ชิ้น", size: "xs", color: "#6B7280", flex: 1, align: "end", weight: "bold" },
            ],
          });
          for (const h of history) {
            rows.push({
              type: "box",
              layout: "horizontal",
              spacing: "sm",
              contents: [
                {
                  type: "text",
                  text: `${h.sessionIndex}${h.isCurrent ? "*" : ""}`,
                  size: "sm",
                  color: h.isCurrent ? "#16A34A" : "#111827",
                  flex: 1,
                  weight: h.isCurrent ? "bold" : "regular",
                },
                {
                  type: "text",
                  text: formatDate(h.receivedAt),
                  size: "sm",
                  color: h.isCurrent ? "#16A34A" : "#111827",
                  flex: 4,
                  weight: h.isCurrent ? "bold" : "regular",
                },
                {
                  type: "text",
                  text: `${h.quantity}`,
                  size: "sm",
                  color: h.isCurrent ? "#16A34A" : "#111827",
                  flex: 1,
                  align: "end",
                  weight: h.isCurrent ? "bold" : "regular",
                },
              ],
            });
          }
          rows.push({
            type: "text",
            text: "* คือรายการนี้",
            size: "xxs",
            color: "#9CA3AF",
            margin: "sm",
          });
        }
      }
    }
  }

  return rows;
};

const collectDamagedPhotos = (order: LoadedServiceOrder): string[] => {
  const urls: string[] = [];
  for (const item of order.serviceOrderItems) {
    for (const img of item.photos) {
      const url = img.image.secureUrl || img.image.url;
      if (url) urls.push(url);
    }
  }
  return urls;
};

export const notifyServiceOrderCreated = async (params: { serviceOrderId: string }): Promise<void> => {
  try {
    const order = await loadServiceOrderForNotify(params.serviceOrderId);
    if (!order) return;

    const setting = await getNotificationSetting();
    const shopName = await getShopName();
    const totalQty = order.serviceOrderItems.reduce((sum, item) => sum + item.quantity, 0);
    const customerName = order.customer.name || order.customer.email || "ลูกค้า";
    const orderUrl = `${getBaseUrl()}/admin/service-orders/${order.id}`;
    const dueSubline = order.dueAt ? `รับผ้าได้: ${formatDateTime(order.dueAt.toISOString())}` : null;

    const bodyContents = await buildOrderBody({
      order,
      status: "RECEIVED",
      customerName,
      totalQty,
      detailed: true,
    });

    const buildFlex = (audience: "customer" | "staff"): LineMessage =>
      buildFlexBubble({
        shopName,
        emoji: statusEmoji.RECEIVED,
        headline: audience === "customer" ? customerHeadline.RECEIVED : staffHeadline("RECEIVED", customerName),
        subline: audience === "customer" ? dueSubline : staffSubline("RECEIVED"),
        bodyContents,
        buttonLabel: "ดูรายละเอียดออเดอร์",
        buttonUrl: orderUrl,
        color: statusColors.RECEIVED,
        altText: `[${shopName}] รับผ้าแล้ว ${order.orderNo ?? ""}`,
      });

    const orderImageUrl = order.image?.secureUrl || order.image?.url || null;
    const allDamagedUrls = collectImageUrls(collectDamagedPhotos(order), 20);
    const totalDamaged = allDamagedUrls.length;

    const buildExtras = (audience: "customer" | "staff"): LineMessage[] => {
      const extras: LineMessage[] = [];
      if (orderImageUrl) {
        extras.push(
          buildTextMessage(
            audience === "customer"
              ? `📸 รับผ้ามาแล้ว ${totalQty} ชิ้น — รูปด้านล่างคือผ้าที่รับตอนเข้าร้านนะคะ/ครับ`
              : `📸 รูปผ้าที่รับเข้าระบบจากคุณ${customerName} (${totalQty} ชิ้น)`,
          ),
        );
        extras.push(buildImageMessage(orderImageUrl));
      }
      if (totalDamaged > 0) {
        extras.push(
          buildTextMessage(
            audience === "customer"
              ? `⚠️ พบผ้าชำรุด ${totalDamaged} จุด ทางร้านได้ถ่ายรูปไว้เป็นหลักฐาน หากมีข้อสงสัยติดต่อร้านได้เลยนะคะ/ครับ`
              : `⚠️ พบผ้าชำรุด ${totalDamaged} จุดในออเดอร์ของคุณ${customerName} — รูปหลักฐานด้านล่าง`,
          ),
        );
        for (const url of allDamagedUrls) {
          extras.push(buildImageMessage(url));
        }
      }
      return extras;
    };

    if (setting[statusToggleMap[order.status]]) {
      await pushToCustomer(order.customerId, [buildFlex("customer"), ...buildExtras("customer")]);
    }
    if (setting.notifyStaffOnNewOrder) {
      await pushToSubscribers("receiveNewOrder", [buildFlex("staff"), ...buildExtras("staff")]);
    }
  } catch (error) {
    console.error("[notify] notifyServiceOrderCreated", error);
  }
};

export const notifyServiceOrderStatusChanged = async (params: {
  serviceOrderId: string;
  fromStatus: ServiceOrderStatus;
  toStatus: ServiceOrderStatus;
}): Promise<void> => {
  if (params.fromStatus === params.toStatus) return;
  try {
    const order = await loadServiceOrderForNotify(params.serviceOrderId);
    if (!order) return;

    const setting = await getNotificationSetting();
    const shopName = await getShopName();
    const totalQty = order.serviceOrderItems.reduce((sum, item) => sum + item.quantity, 0);
    const customerName = order.customer.name || order.customer.email || "ลูกค้า";
    const orderUrl = `${getBaseUrl()}/admin/service-orders/${order.id}`;

    const bodyContents = await buildOrderBody({
      order,
      status: params.toStatus,
      customerName,
      totalQty,
      detailed: params.toStatus === "COMPLETED",
    });

    const buildFlex = (audience: "customer" | "staff"): LineMessage =>
      buildFlexBubble({
        shopName,
        emoji: statusEmoji[params.toStatus],
        headline:
          audience === "customer"
            ? customerHeadline[params.toStatus]
            : staffHeadline(params.toStatus, customerName),
        subline: audience === "customer" ? customerSubline(params.toStatus) : staffSubline(params.toStatus),
        bodyContents,
        buttonLabel: "ดูรายละเอียดออเดอร์",
        buttonUrl: orderUrl,
        color: statusColors[params.toStatus],
        altText: `[${shopName}] ${order.orderNo ?? ""} ${serviceOrderStatusLabels[params.toStatus]}`,
      });

    const deliveryUrl =
      params.toStatus === "COMPLETED"
        ? order.deliveryImage?.secureUrl || order.deliveryImage?.url || null
        : null;

    const buildExtras = (audience: "customer" | "staff"): LineMessage[] => {
      const extras: LineMessage[] = [];
      if (deliveryUrl) {
        extras.push(
          buildTextMessage(
            audience === "customer"
              ? "📦 ส่งผ้าเรียบร้อยแล้ว ขอบคุณที่ใช้บริการ — รูปด้านล่างคือหลักฐานการส่งผ้านะคะ/ครับ"
              : `📦 ส่งผ้าให้คุณ${customerName}เรียบร้อย — รูปหลักฐานการส่งด้านล่าง`,
          ),
        );
        extras.push(buildImageMessage(deliveryUrl));
      }
      return extras;
    };

    if (setting[statusToggleMap[params.toStatus]]) {
      await pushToCustomer(order.customerId, [buildFlex("customer"), ...buildExtras("customer")]);
    }
    await pushToSubscribers("receiveStatusChange", [buildFlex("staff"), ...buildExtras("staff")]);
  } catch (error) {
    console.error("[notify] notifyServiceOrderStatusChanged", error);
  }
};

export const notifyReceipt = async (params: { paymentId: string }): Promise<void> => {
  try {
    const payment = await prisma.paymentRecord.findFirst({
      where: { id: params.paymentId, deletedAt: null },
      select: {
        id: true,
        paymentNo: true,
        amount: true,
        paymentMethod: true,
        userId: true,
        user: { select: { name: true, email: true } },
        metadata: true,
        memberEntitlementId: true,
        packageSale: {
          select: {
            id: true,
            subtotalAmount: true,
            discountAmount: true,
            totalAmount: true,
            items: {
              orderBy: { createdAt: "asc" },
              select: {
                qty: true,
                product: { select: { name: true, packageType: true } },
                memberEntitlements: {
                  where: { deletedAt: null },
                  select: {
                    creditInitial: true,
                    creditRemaining: true,
                    startAt: true,
                    endAt: true,
                  },
                },
              },
            },
          },
        },
      },
    });
    if (!payment) return;

    const setting = await getNotificationSetting();
    if (!setting.notifyCustomerReceipt) return;

    const shopName = await getShopName();
    const customerName = payment.user.name || payment.user.email || "ลูกค้า";
    const receiptCode = payment.paymentNo || `PAY-${payment.id.slice(-8).toUpperCase()}`;
    const totalAmount = Number(payment.amount);
    const methodLabel = payment.paymentMethod === "CASH" ? "เงินสด" : "โอน";
    const receiptUrl = `${getBaseUrl()}/admin/payment/${payment.id}/receipt`;

    const body: FlexBox[] = [
      kvRow("เลขที่บิล", receiptCode),
      kvRow("ลูกค้า", customerName),
      kvRow("ช่องทางชำระ", methodLabel),
    ];

    const paymentMeta = (payment.metadata ?? null) as { vat?: { rate?: number; amount?: number; included?: boolean; baseAmount?: number } } | null;
    const vatInfo = paymentMeta?.vat;
    if (vatInfo && Number(vatInfo.rate ?? 0) > 0) {
      body.push(kvRow(vatInfo.included ? `รวม VAT ${vatInfo.rate}%` : `VAT ${vatInfo.rate}%`, `฿${formatCurrency(Number(vatInfo.amount ?? 0))}`));
    }
    body.push(kvRow("ยอดรวม", `฿${formatCurrency(totalAmount)}`));

    if (payment.packageSale && payment.packageSale.items.length) {
      body.push(divider());
      body.push(sectionHeading("แพ็กเกจที่คุณได้รับ"));

      let earliestStart: Date | null = null;
      let latestEnd: Date | null = null;
      let totalCreditInitial = 0;
      let totalCreditRemaining = 0;

      for (const item of payment.packageSale.items) {
        const typeLabel = item.product.packageType === "MAIN" ? "แพ็กเกจหลัก" : "แพ็กเกจเสริม";
        body.push(kvRow(typeLabel, `${item.product.name} x${item.qty}`));

        for (const ent of item.memberEntitlements) {
          totalCreditInitial += ent.creditInitial ?? 0;
          totalCreditRemaining += ent.creditRemaining ?? 0;
          if (ent.startAt && (!earliestStart || ent.startAt < earliestStart)) earliestStart = ent.startAt;
          if (ent.endAt && (!latestEnd || ent.endAt > latestEnd)) latestEnd = ent.endAt;
        }
      }

      if (totalCreditInitial > 0) {
        body.push(kvRow("เครดิตรวม", `${totalCreditRemaining}/${totalCreditInitial} เครดิต`));
      }
      if (earliestStart) {
        body.push(kvRow("เริ่มใช้ได้", formatDate(earliestStart.toISOString())));
      }
      if (latestEnd) {
        body.push(kvRow("หมดอายุ", formatDate(latestEnd.toISOString())));
      } else if (earliestStart) {
        body.push(kvRow("อายุการใช้งาน", "ไม่กำหนด"));
      }
    }

    const flex = buildFlexBubble({
      shopName,
      emoji: "🎉",
      headline: "ขอบคุณที่ซื้อแพ็กเกจกับเรา",
      subline: "ใบเสร็จและรายละเอียดแพ็กเกจอยู่ด้านล่างนี้",
      bodyContents: body,
      buttonLabel: "ดูใบเสร็จ",
      buttonUrl: receiptUrl,
      color: "#16A34A",
      altText: `[${shopName}] ใบเสร็จ ${receiptCode}`,
    });

    const messages: LineMessage[] = [flex];

    await pushToCustomer(payment.userId, messages);
    await pushToSubscribers("receiveReceipt", messages);
  } catch (error) {
    console.error("[notify] notifyReceipt", error);
  }
};
