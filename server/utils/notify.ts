import { prisma } from "~~/server/utils/prisma";
import { pushMessage, type LineMessage } from "~~/server/utils/line-messaging";
import { isWalkInCustomerEmail } from "~~/server/utils/walkInCustomer";
import type { ServiceOrderStatus } from "~~/shared/types/enums";
import { formatDate, formatDateTime } from "~~/shared/utils/format";

type CustomerLike = { name?: string | null; email?: string | null; phoneNumber?: string | null } | null | undefined;

type OrderWalkInInfo = {
  isWalkIn?: boolean | null;
  walkInName?: string | null;
  walkInPhone?: string | null;
  customer?: CustomerLike;
};

const isWalkInCustomer = (customer: CustomerLike): boolean =>
  Boolean(customer && isWalkInCustomerEmail(customer.email));

const isWalkInOrder = (order: OrderWalkInInfo | null | undefined): boolean =>
  Boolean(order?.isWalkIn) || isWalkInCustomer(order?.customer);

type ResolvedCustomer = {
  name: string;
  label: string;
  phone: string | null;
  walkIn: boolean;
};

const resolveOrderCustomer = (order: OrderWalkInInfo | null | undefined): ResolvedCustomer => {
  if (isWalkInOrder(order)) {
    const rawName = order?.walkInName?.trim() || "";
    const rawPhone = order?.walkInPhone?.trim() || "";
    const name = rawName || "ไม่ระบุ";
    return {
      name: `${name} (ลูกค้าหน้าร้าน)`,
      label: rawName ? `คุณ ${rawName}` : "ไม่ระบุ (ลูกค้าหน้าร้าน)",
      phone: rawPhone || null,
      walkIn: true,
    };
  }
  const c = order?.customer;
  const name = c?.name?.trim() || c?.email || "ลูกค้า";
  const phone = c?.phoneNumber?.trim() || null;
  return { name, label: `คุณ ${name}`, phone, walkIn: false };
};

const customerHasDeliveryAddon = async (customerId: string): Promise<boolean> => {
  const count = await prisma.memberEntitlement.count({
    where: {
      customerId,
      status: "ACTIVE",
      deletedAt: null,
      product: { isDelivery: true, deletedAt: null },
    },
  });
  return count > 0;
};

type ServiceOrderStatusLabels = Record<ServiceOrderStatus, string>;

export const serviceOrderStatusLabels: ServiceOrderStatusLabels = {
  RECEIVED: "รับผ้าแล้ว",
  PROCESSING: "กำลังดำเนินการ",
  DELIVERING: "พร้อมส่ง / กำลังจัดส่ง",
  COMPLETED: "ส่งผ้าเรียบร้อย",
  CANCELLED: "ยกเลิก",
};

const customerHeadlineFor = (status: ServiceOrderStatus, hasDelivery: boolean): string => {
  if (status === "DELIVERING") {
    return hasDelivery ? "กำลังจัดส่งผ้าถึงบ้านคุณ" : "ผ้าซักเสร็จแล้ว เชิญรับที่ร้าน";
  }
  switch (status) {
    case "RECEIVED": return "รับผ้าจากคุณเรียบร้อยแล้ว";
    case "PROCESSING": return "กำลังดำเนินการ";
    case "COMPLETED": return "ส่งผ้าเรียบร้อย ขอบคุณที่ใช้บริการ";
    case "CANCELLED": return "ออเดอร์นี้ถูกยกเลิกแล้ว";
  }
  return "";
};

const staffHeadlineFor = (status: ServiceOrderStatus, customerLabel: string, hasDelivery: boolean): string => {
  const c = customerLabel || "ลูกค้า";
  switch (status) {
    case "RECEIVED":
      return `รับผ้าจาก${c} เรียบร้อยแล้ว`;
    case "PROCESSING":
      return `กำลังดำเนินการให้${c}`;
    case "DELIVERING":
      return hasDelivery ? `กำลังจัดส่งผ้าให้${c} ที่บ้าน` : `ผ้าของ${c} พร้อมให้รับที่ร้าน`;
    case "COMPLETED":
      return `ส่งผ้าให้${c} เรียบร้อยแล้ว`;
    case "CANCELLED":
      return `ออเดอร์ของ${c} ถูกยกเลิก`;
  }
};

const customerSublineFor = (status: ServiceOrderStatus, hasDelivery: boolean): string | null => {
  if (status === "DELIVERING") {
    return hasDelivery
      ? "ทีมงานกำลังจัดส่งให้ — โปรดเตรียมผ้ารอบถัดไปไว้ให้พนักงานรับด้วยนะคะ/ครับ"
      : "ผ้าของคุณพร้อมรับที่ร้านได้เลย ขอบคุณที่ใช้บริการ";
  }
  if (status === "PROCESSING") return "ทีมงานกำลังดูแลผ้าของคุณอย่างดี";
  return null;
};

const staffSublineFor = (status: ServiceOrderStatus, hasDelivery: boolean): string | null => {
  if (status === "RECEIVED") return "มีออเดอร์ใหม่เข้าระบบ";
  if (status === "DELIVERING") return hasDelivery ? "ทีมงานออกส่งผ้าแล้ว — รับผ้ารอบถัดไปกลับมาด้วย" : "ผ้าพร้อมให้ลูกค้ามารับ";
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

const itemRow = (name: string, qty: number, total: number, isPackage: boolean, isWashFold = false): FlexBox => ({
  type: "box",
  layout: "horizontal",
  spacing: "sm",
  contents: [
    { type: "text", text: `• ${name}`, size: "sm", color: "#111827", flex: 5, wrap: true },
    { type: "text", text: `x${qty}`, size: "sm", color: "#6B7280", flex: 1, align: "end" },
    {
      type: "text",
      text: isWashFold ? "ชั่งกิโล" : (isPackage ? "ใช้แพ็กเกจ" : `฿${formatCurrency(total)}`),
      size: "sm",
      color: isWashFold ? "#F59E0B" : (isPackage ? "#16A34A" : "#111827"),
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
      isWalkIn: true,
      walkInName: true,
      walkInPhone: true,
      subtotalAmount: true,
      discountAmount: true,
      totalAmount: true,
      hangerCharge: true,
      weightKg: true,
      washFoldPricePerKgSnapshot: true,
      note: true,
      customer: { select: { name: true, email: true, phoneNumber: true } },
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
          weightKg: true,
          weightLabel: true,
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
  customerPhone?: string | null;
  isWalkIn?: boolean;
  totalQty: number;
  detailed: boolean;
}): Promise<FlexBox[]> => {
  const { order, status, customerName, customerPhone, isWalkIn, totalQty, detailed } = params;
  const orderNo = order.orderNo || `ORDER-${order.id.slice(-8).toUpperCase()}`;
  const isPackage = Boolean(order.memberEntitlement);
  const rows: FlexBox[] = [
    kvRow("เลขรับผ้า", orderNo),
    kvRow("ชื่อลูกค้า", customerName),
    kvRow("เบอร์โทร", customerPhone || "ไม่ระบุ"),
  ];
  void isWalkIn;
  rows.push(
    kvRow(
      "รูปแบบบริการ",
      order.weightKg != null
        ? "ซัก-พับ ชั่งกิโล"
        : isPackage ? "แพ็กเกจรายเดือน" : "ราคาหน้าร้าน",
    ),
    kvRow("วันที่รับผ้า", formatDateTime(order.receivedAt.toISOString())),
  );

  if (status === "RECEIVED" || status === "PROCESSING" || status === "DELIVERING") {
    rows.push(kvRow("นัดรับ", order.dueAt ? formatDateTime(order.dueAt.toISOString()) : "ไม่ระบุ"));
  }

  if (status === "COMPLETED") {
    rows.push(kvRow("วันที่ส่งผ้า", formatDateTime(order.updatedAt.toISOString())));
  }

  rows.push(kvRow("จำนวนผ้า", `${totalQty} ชิ้น`));
  if (order.weightKg != null) {
    rows.push(kvRow("น้ำหนัก", `${Number(order.weightKg).toFixed(1)} กก.`));
  }

  if (detailed) {
    rows.push(divider());
    rows.push(sectionHeading("รายการบริการ"));
    const isWashFoldMode = order.weightKg != null;
    for (const item of order.serviceOrderItems) {
      if (item.storefrontPrice) {
        const itemName = item.storefrontPrice.storefrontItem.name;
        const serviceName = item.storefrontPrice.storefrontService.name;
        rows.push(
          itemRow(
            `${itemName} (${serviceName})`,
            item.quantity,
            Number(item.totalPrice),
            isWashFoldMode ? false : item.isPackageIncluded,
            isWashFoldMode,
          ),
        );
      }
    }
    if (isWashFoldMode && order.washFoldPricePerKgSnapshot != null) {
      rows.push(divider());
      rows.push(
        itemRow(
          `ซัก-พับ ${Number(order.weightKg).toFixed(1)} กก. × ${formatCurrency(Number(order.washFoldPricePerKgSnapshot))}`,
          1,
          Number(order.subtotalAmount),
          false,
        ),
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
    const resolved = resolveOrderCustomer(order);
    const customerName = resolved.name;
    const customerLabel = resolved.label;
    const orderUrl = `${getBaseUrl()}/admin/service-orders/${order.id}`;
    const dueSubline = order.dueAt ? `รับผ้าได้: ${formatDateTime(order.dueAt.toISOString())}` : null;
    const hasDelivery = await customerHasDeliveryAddon(order.customerId);

    const bodyContents = await buildOrderBody({
      order,
      status: "RECEIVED",
      customerName,
      customerPhone: resolved.phone,
      isWalkIn: resolved.walkIn,
      totalQty,
      detailed: true,
    });

    const buildFlex = (audience: "customer" | "staff"): LineMessage =>
      buildFlexBubble({
        shopName,
        emoji: statusEmoji.RECEIVED,
        headline: audience === "customer" ? customerHeadlineFor("RECEIVED", hasDelivery) : staffHeadlineFor("RECEIVED", customerLabel, hasDelivery),
        subline: audience === "customer" ? dueSubline : staffSublineFor("RECEIVED", hasDelivery),
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
              : `📸 รูปผ้าที่รับเข้าระบบจาก${customerLabel} (${totalQty} ชิ้น)`,
          ),
        );
        extras.push(buildImageMessage(orderImageUrl));
      }
      if (totalDamaged > 0) {
        extras.push(
          buildTextMessage(
            audience === "customer"
              ? `⚠️ พบผ้าชำรุด ${totalDamaged} จุด ทางร้านได้ถ่ายรูปไว้เป็นหลักฐาน หากมีข้อสงสัยติดต่อร้านได้เลยนะคะ/ครับ`
              : `⚠️ พบผ้าชำรุด ${totalDamaged} จุดในออเดอร์ของ${customerLabel} — รูปหลักฐานด้านล่าง`,
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
    const resolved = resolveOrderCustomer(order);
    const customerName = resolved.name;
    const customerLabel = resolved.label;
    const orderUrl = `${getBaseUrl()}/admin/service-orders/${order.id}`;
    const hasDelivery = await customerHasDeliveryAddon(order.customerId);

    const bodyContents = await buildOrderBody({
      order,
      status: params.toStatus,
      customerName,
      customerPhone: resolved.phone,
      isWalkIn: resolved.walkIn,
      totalQty,
      detailed: params.toStatus === "COMPLETED",
    });

    const buildFlex = (audience: "customer" | "staff"): LineMessage =>
      buildFlexBubble({
        shopName,
        emoji: statusEmoji[params.toStatus],
        headline:
          audience === "customer"
            ? customerHeadlineFor(params.toStatus, hasDelivery)
            : staffHeadlineFor(params.toStatus, customerLabel, hasDelivery),
        subline: audience === "customer" ? customerSublineFor(params.toStatus, hasDelivery) : staffSublineFor(params.toStatus, hasDelivery),
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
              : `📦 ส่งผ้าให้${customerLabel} เรียบร้อย — รูปหลักฐานการส่งด้านล่าง`,
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
        receiptNo: true,
        amount: true,
        method: true,
        userId: true,
        paidAt: true,
        updatedAt: true,
        confirmedBy: { select: { id: true, name: true } },
        user: { select: { name: true, email: true, phoneNumber: true } },
        metadata: true,
        memberEntitlementId: true,
        slipImage: { select: { secureUrl: true, url: true } },
        serviceOrder: {
          select: {
            id: true,
            orderNo: true,
            isWalkIn: true,
            walkInName: true,
            walkInPhone: true,
            subtotalAmount: true,
            discountAmount: true,
            totalAmount: true,
            hangerCharge: true,
            serviceOrderItems: {
              where: { deletedAt: null },
              select: {
                id: true,
                quantity: true,
                unitPrice: true,
                totalPrice: true,
                storefrontPrice: {
                  select: { storefrontItem: { select: { name: true } } },
                },
              },
            },
          },
        },
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
    const shopName = await getShopName();

    const resolved = resolveOrderCustomer({
      isWalkIn: payment.serviceOrder?.isWalkIn ?? false,
      walkInName: payment.serviceOrder?.walkInName ?? null,
      walkInPhone: payment.serviceOrder?.walkInPhone ?? null,
      customer: payment.user,
    });
    const customerName = resolved.name;
    const receiptCode = payment.receiptNo || payment.paymentNo || `RC-${payment.id.slice(-8).toUpperCase()}`;
    const totalAmount = Number(payment.amount);
    const methodLabel = payment.method === "TRANSFER" ? "โอนเงิน" : payment.method === "CASH" ? "เงินสด" : null;
    const isServiceOrder = Boolean(payment.serviceOrder);
    const isPackageSale = Boolean(payment.packageSale && payment.packageSale.items.length);
    const saleKind: "PACKAGE" | "STOREFRONT" | "OTHER" = isPackageSale
      ? "PACKAGE"
      : isServiceOrder
        ? "STOREFRONT"
        : "OTHER";
    const saleKindLabel =
      saleKind === "PACKAGE" ? "แพ็กเกจ" : saleKind === "STOREFRONT" ? "รายการซักรีด" : "ทั่วไป";
    const saleKindEmoji = saleKind === "PACKAGE" ? "🎁" : saleKind === "STOREFRONT" ? "🧺" : "🎉";
    const saleKindBadge =
      saleKind === "PACKAGE" ? "🎁 แพ็กเกจ" : saleKind === "STOREFRONT" ? "🧺 รายการซักรีด" : "🎉 ทั่วไป";

    const serviceOrderItems = (payment.serviceOrder?.serviceOrderItems ?? []).map((item) => ({
      name: item.storefrontPrice?.storefrontItem?.name ?? "รายการ",
      qty: item.quantity,
      unitPrice: Number(item.unitPrice),
    }));

    const packageItems = (payment.packageSale?.items ?? []).map((item) => ({
      name: item.product.name,
      qty: item.qty,
    }));

    let totalCreditInitial = 0;
    let totalCreditRemaining = 0;
    for (const item of (payment.packageSale?.items ?? [])) {
      for (const ent of item.memberEntitlements) {
        totalCreditInitial += ent.creditInitial ?? 0;
        totalCreditRemaining += ent.creditRemaining ?? 0;
      }
    }

    const serviceOrder = payment.serviceOrder;
    const subtotal = serviceOrder?.subtotalAmount != null ? Number(serviceOrder.subtotalAmount) : 0;
    const discountAmount = serviceOrder?.discountAmount != null ? Number(serviceOrder.discountAmount) : 0;

    const slipUrl = payment.method === "TRANSFER"
      ? payment.slipImage?.secureUrl || payment.slipImage?.url || null
      : null;

    const buildStaffFlex = (): LineMessage => {
      const body: FlexBox[] = [
        kvRow("ประเภทรายการ", saleKindBadge),
        kvRow("เลขที่ใบเสร็จ", receiptCode),
        kvRow("ชื่อลูกค้า", customerName),
        kvRow("เบอร์โทร", resolved.phone || "ไม่ระบุ"),
        kvRow("วันที่", formatDateTime((payment.paidAt ?? payment.updatedAt).toISOString())),
        kvRow("พนักงาน", payment.confirmedBy?.name || "-"),
      ];
      if (methodLabel) body.push(kvRow("วิธีชำระเงิน", methodLabel));

      if (isServiceOrder && serviceOrderItems.length) {
        body.push(divider());
        body.push(sectionHeading("รายการบริการ"));
        for (const item of serviceOrderItems) {
          body.push(kvRow(item.name, `×${item.qty} — ฿${formatCurrency(item.unitPrice)}`));
        }
        body.push(kvRow("ราคารวม", `฿${formatCurrency(subtotal)}`));
        const hanger = (serviceOrder?.hangerCharge ?? null) as { count?: number; total?: number } | null;
        if (hanger && Number(hanger.total) > 0) {
          body.push(kvRow("ค่าไม้แขวน", `฿${formatCurrency(Number(hanger.total))}`));
        }
        if (discountAmount > 0) body.push(kvRow("ส่วนลด", `-฿${formatCurrency(discountAmount)}`));
        body.push(kvRow("ยอดสุทธิ", `฿${formatCurrency(totalAmount)}`));
      }

      if (isPackageSale && packageItems.length) {
        body.push(divider());
        body.push(sectionHeading("แพ็กเกจ"));
        for (const pkg of packageItems) {
          body.push(kvRow(pkg.name, `×${pkg.qty}`));
        }
        body.push(kvRow("เครดิต", `${totalCreditRemaining}/${totalCreditInitial} ครั้ง`));
      }

      const staffHeadline =
        saleKind === "PACKAGE"
          ? `ชำระค่าแพ็กเกจ — ${customerName}`
          : saleKind === "STOREFRONT"
            ? `ชำระค่าซักรีด — ${customerName}`
            : `ชำระเงินเรียบร้อย — ${customerName}`;

      return buildFlexBubble({
        shopName,
        emoji: saleKindEmoji,
        headline: staffHeadline,
        subline: `${saleKindBadge} · ${receiptCode}`,
        bodyContents: body,
        buttonLabel: "ดูใบเสร็จ",
        buttonUrl: `${getBaseUrl()}/admin/payment/${payment.id}/receipt`,
        color: "#16A34A",
        altText: `[${shopName}] ใบเสร็จ${saleKindLabel} ${receiptCode} — ${customerName}`,
      });
    };

    const buildCustomerFlex = (): LineMessage => {
      const body: FlexBox[] = [
        kvRow("ประเภทรายการ", saleKindBadge),
        kvRow("เลขที่ใบเสร็จ", receiptCode),
        kvRow("ยอดชำระ", `฿${formatCurrency(totalAmount)}`),
        kvRow("วันที่", formatDateTime((payment.paidAt ?? payment.updatedAt).toISOString())),
      ];
      if (methodLabel) body.push(kvRow("วิธีชำระเงิน", methodLabel));

      if (isServiceOrder) {
        body.push(kvRow("เลขรับผ้า", payment.serviceOrder?.orderNo || "-"));
        body.push(kvRow("รายการ", `${serviceOrderItems.length} รายการ`));
      }
      if (isPackageSale && packageItems.length) {
        body.push(kvRow("แพ็กเกจ", packageItems.map((i) => i.name).join(", ")));
        body.push(kvRow("เครดิต", `${totalCreditRemaining}/${totalCreditInitial} ครั้ง`));
      }

      const customerHeadline =
        saleKind === "PACKAGE"
          ? "ชำระค่าแพ็กเกจเรียบร้อย ขอบคุณที่ซื้อแพ็กเกจกับเรา"
          : saleKind === "STOREFRONT"
            ? "ชำระค่าบริการซักรีดเรียบร้อย ขอบคุณที่ใช้บริการ"
            : "ชำระเงินเรียบร้อย ขอบคุณที่ใช้บริการ";
      const customerSubline =
        saleKind === "PACKAGE"
          ? "ใบเสร็จและรายละเอียดแพ็กเกจอยู่ด้านล่างนี้"
          : "ใบเสร็จอยู่ด้านล่างนี้";

      return buildFlexBubble({
        shopName,
        emoji: saleKindEmoji,
        headline: customerHeadline,
        subline: customerSubline,
        bodyContents: body,
        buttonLabel: "ดูใบเสร็จ",
        buttonUrl: `${getBaseUrl()}/me/payment/${payment.id}`,
        color: "#16A34A",
        altText: `[${shopName}] ใบเสร็จ${saleKindLabel} ${receiptCode}`,
      });
    };

    if (setting.notifyCustomerReceipt) {
      await pushToCustomer(payment.userId, [buildCustomerFlex()]);
    }

    await pushToSubscribers("receiveReceipt", [buildStaffFlex()]);

    if (slipUrl) {
      await pushToSubscribers("receiveReceipt", [
        buildTextMessage("📎 หลักฐานการโอนเงิน"),
        buildImageMessage(slipUrl),
      ]);
    }
  } catch (error) {
    console.error("[notify] notifyReceipt", error);
  }
};

export const notifyQuotationCreated = async (params: { serviceOrderId: string }): Promise<void> => {
  try {
    const order = await prisma.serviceOrder.findFirst({
      where: { id: params.serviceOrderId, deletedAt: null },
      select: {
        id: true,
        orderNo: true,
        quotationNo: true,
        customerId: true,
        totalAmount: true,
        dueAt: true,
        receivedAt: true,
        isWalkIn: true,
        walkInName: true,
        walkInPhone: true,
        customer: { select: { name: true, email: true, phoneNumber: true } },
        payments: {
          where: { deletedAt: null },
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { id: true, amount: true, status: true },
        },
      },
    });
    if (!order) return;

    const setting = await getNotificationSetting();
    const customerCanReceive = (setting as { notifyCustomerOnQuotation?: boolean }).notifyCustomerOnQuotation !== false;
    if (!customerCanReceive) return;

    const payment = order.payments[0];
    if (!payment || payment.status !== "UNPAID") return;

    const shopName = await getShopName();
    const resolved = resolveOrderCustomer(order);
    const customerName = resolved.name;
    const code = order.quotationNo || order.orderNo || `QT-${order.id.slice(-8).toUpperCase()}`;
    const amount = Number(payment.amount ?? order.totalAmount ?? 0);
    const url = `${getBaseUrl()}/admin/payment/${payment.id}/quotation`;

    const body: FlexBox[] = [
      kvRow("เลขที่ใบแจ้งราคา", code),
      kvRow("ลูกค้า", customerName),
      kvRow("ยอดที่ต้องชำระ", `฿${formatCurrency(amount)}`),
    ];
    body.push(kvRow("เบอร์โทร", resolved.phone || "ไม่ระบุ"));
    if (order.dueAt) body.push(kvRow("วันนัดรับ", formatDateTime(order.dueAt.toISOString())));

    const flex = buildFlexBubble({
      shopName,
      emoji: "🧾",
      headline: "ใบแจ้งราคาออกแล้ว",
      subline: "ชำระเงินเพื่อรับใบเสร็จได้เลย",
      bodyContents: body,
      buttonLabel: "ดูใบแจ้งราคา",
      buttonUrl: url,
      color: "#0EA5E9",
      altText: `[${shopName}] ใบแจ้งราคา ${code}`,
    });

    await pushToCustomer(order.customerId, [flex]);
    await pushToSubscribers("receiveNewOrder", [flex]);
  } catch (error) {
    console.error("[notify] notifyQuotationCreated", error);
  }
};
