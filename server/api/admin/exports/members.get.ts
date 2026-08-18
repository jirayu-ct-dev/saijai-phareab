import { prisma } from "~~/server/utils/prisma";
import { requireRole } from "~~/server/utils/auth";
import { buildCsv, formatBangkokDateTag, formatBangkokDateTime, parseDateRange, sendCsv } from "~~/server/utils/csv";
import { isInternalCustomerEmail } from "~~/server/utils/customerAccount";

const statusLabel: Record<string, string> = {
  ACTIVE: "ใช้งานได้",
  PENDING: "รอเปิดใช้",
  EXPIRED: "หมดอายุ",
  SUSPENDED: "ระงับ",
  CANCELLED: "ยกเลิก",
};

export default defineEventHandler(async (event) => {
  requireRole(event, ["ADMIN"]);

  const query = getQuery(event);
  const { from, to } = parseDateRange(query.from, query.to);

  const ents = await prisma.memberEntitlement.findMany({
    where: { deletedAt: null, createdAt: { gte: from, lte: to } },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      status: true,
      creditInitial: true,
      creditRemaining: true,
      startAt: true,
      endAt: true,
      activatedAt: true,
      createdAt: true,
      customer: { select: { name: true, email: true, phoneNumber: true } },
      product: { select: { name: true, packageType: true, price: true } },
    },
  });

  const rows = ents.map((e) => ({
    "ลูกค้า": e.customer.name ?? "",
    "อีเมล": isInternalCustomerEmail(e.customer.email) ? "" : e.customer.email,
    "เบอร์": e.customer.phoneNumber ?? "",
    "แพ็กเกจ": e.product.name,
    "ประเภท": e.product.packageType === "MAIN" ? "แพ็กเกจหลัก" : "แพ็กเกจเสริม",
    "ราคา": Number(e.product.price),
    "เครดิตเริ่ม": e.creditInitial ?? 0,
    "เครดิตคงเหลือ": e.creditRemaining ?? 0,
    "เครดิตที่ใช้": Math.max((e.creditInitial ?? 0) - (e.creditRemaining ?? 0), 0),
    "สถานะ": statusLabel[e.status] ?? e.status,
    "วันที่ซื้อ": formatBangkokDateTime(e.createdAt),
    "วันเริ่มใช้": formatBangkokDateTime(e.startAt),
    "วันหมดอายุ": formatBangkokDateTime(e.endAt),
  }));

  const headers = [
    "ลูกค้า", "อีเมล", "เบอร์",
    "แพ็กเกจ", "ประเภท", "ราคา",
    "เครดิตเริ่ม", "เครดิตคงเหลือ", "เครดิตที่ใช้",
    "สถานะ", "วันที่ซื้อ", "วันเริ่มใช้", "วันหมดอายุ",
  ];
  const csv = buildCsv(headers, rows);
  const fromTag = formatBangkokDateTag(from);
  const toTag = formatBangkokDateTag(to);
  return sendCsv(`members-${fromTag}-to-${toTag}`, csv);
});
