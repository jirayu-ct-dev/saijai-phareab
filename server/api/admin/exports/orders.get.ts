import { prisma } from "~~/server/utils/prisma";
import { requireRole } from "~~/server/utils/auth";
import { buildCsv, formatBangkokDateTag, formatBangkokDateTime, parseDateRange, sendCsv } from "~~/server/utils/csv";
import { isInternalCustomerEmail } from "~~/server/utils/customerAccount";

const statusLabel: Record<string, string> = {
  RECEIVED: "รับผ้าแล้ว",
  PROCESSING: "กำลังดำเนินการ",
  DELIVERING: "พร้อมส่ง",
  COMPLETED: "เสร็จสิ้น",
  CANCELLED: "ยกเลิก",
};

export default defineEventHandler(async (event) => {
  requireRole(event, ["ADMIN"]);

  const query = getQuery(event);
  const { from, to } = parseDateRange(query.from, query.to);

  const orders = await prisma.serviceOrder.findMany({
    where: { deletedAt: null, receivedAt: { gte: from, lte: to } },
    orderBy: { receivedAt: "asc" },
    select: {
      id: true,
      orderNo: true,
      status: true,
      receivedAt: true,
      dueAt: true,
      updatedAt: true,
      subtotalAmount: true,
      discountAmount: true,
      totalAmount: true,
      creditUsed: true,
      hangerCharge: true,
      customer: { select: { name: true, email: true, phoneNumber: true } },
      employee: { select: { name: true } },
      memberEntitlement: { select: { product: { select: { name: true } } } },
      weightKg: true,
      addonUsageRecords: {
        select: {
          productName: true,
          credits: true,
          deductOn: true,
          deductedAt: true,
          refundedAt: true,
        },
      },
      _count: { select: { serviceOrderItems: { where: { deletedAt: null } } } },
      serviceOrderItems: {
        where: { deletedAt: null },
        select: {
          quantity: true,
          storefrontPrice: {
            select: {
              storefrontItem: { select: { name: true } },
              storefrontService: { select: { name: true } },
            },
          },
        },
      },
    },
  });

  const rows = orders.map((o) => {
    const isWashFold = o.weightKg != null;
    const totalQty = o.serviceOrderItems.reduce((s, it) => s + it.quantity, 0);
    const hanger = (o.hangerCharge ?? null) as { count?: number; total?: number } | null;
    const addonNames = o.addonUsageRecords.map((usage) => usage.productName || "แพ็กเกจเสริม").filter(Boolean);
    const addonCredits = o.addonUsageRecords.reduce((sum, usage) => sum + Number(usage.credits ?? 0), 0);
    const itemSummary = o.serviceOrderItems
      .map((item) => {
        const name = item.storefrontPrice
          ? `${item.storefrontPrice.storefrontItem.name} (${item.storefrontPrice.storefrontService.name})`
          : "รายการไม่ระบุ";
        return `${name} × ${item.quantity}`;
      })
      .join(", ");
    return {
      "เลขรับผ้า": o.orderNo ?? o.id,
      "วันที่รับผ้า": formatBangkokDateTime(o.receivedAt),
      "นัดรับ": formatBangkokDateTime(o.dueAt),
      "วันที่ส่ง": o.status === "COMPLETED" ? formatBangkokDateTime(o.updatedAt) : "",
      "สถานะ": statusLabel[o.status] ?? o.status,
      "ลูกค้า": o.customer.name ?? "",
      "อีเมล": isInternalCustomerEmail(o.customer.email) ? "" : o.customer.email,
      "เบอร์": o.customer.phoneNumber ?? "",
      "รูปแบบ": isWashFold ? "ซัก-พับ ชั่งกิโล" : (o.memberEntitlement ? "แพ็กเกจรายเดือน" : "ราคาหน้าร้าน"),
      "แพ็กเกจ": o.memberEntitlement?.product.name ?? "",
      "แพ็กเกจเสริม": addonNames.join(", "),
      "เครดิตแพ็กเกจเสริม": addonCredits,
      "จำนวนชิ้น": totalQty,
      "รายการผ้า": itemSummary,
      "น้ำหนัก (กก.)": isWashFold ? Number(o.weightKg) : 0,
      "ใช้เครดิต": o.creditUsed ?? 0,
      "ราคารวม": Number(o.subtotalAmount),
      "ส่วนลด": Number(o.discountAmount),
      "ค่าไม้แขวน": Number(hanger?.total ?? 0),
      "จำนวนไม้แขวน": Number(hanger?.count ?? 0),
      "ยอดสุทธิ": o.totalAmount != null ? Number(o.totalAmount) : 0,
      "พนักงาน": o.employee?.name ?? "",
    };
  });

  const headers = [
    "เลขรับผ้า", "วันที่รับผ้า", "นัดรับ", "วันที่ส่ง", "สถานะ",
    "ลูกค้า", "อีเมล", "เบอร์",
    "รูปแบบ", "แพ็กเกจ", "แพ็กเกจเสริม", "เครดิตแพ็กเกจเสริม",
    "จำนวนชิ้น", "รายการผ้า", "น้ำหนัก (กก.)", "ใช้เครดิต",
    "ราคารวม", "ส่วนลด", "ค่าไม้แขวน", "จำนวนไม้แขวน", "ยอดสุทธิ",
    "พนักงาน",
  ];
  const csv = buildCsv(headers, rows);
  const fromTag = formatBangkokDateTag(from);
  const toTag = formatBangkokDateTag(to);
  return sendCsv(`orders-${fromTag}-to-${toTag}`, csv);
});
