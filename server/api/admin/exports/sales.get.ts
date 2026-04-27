import { prisma } from "~~/server/utils/prisma";
import { requireRole } from "~~/server/utils/auth";
import { buildCsv, formatBangkokDateTime, parseDateRange, sendCsv } from "~~/server/utils/csv";

export default defineEventHandler(async (event) => {
  requireRole(event, ["ADMIN"]);

  const query = getQuery(event);
  const { from, to } = parseDateRange(query.from, query.to);

  const payments = await prisma.paymentRecord.findMany({
    where: { deletedAt: null, createdAt: { gte: from, lte: to } },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      paymentNo: true,
      createdAt: true,
      paidAt: true,
      amount: true,
      paymentMethod: true,
      note: true,
      packageSaleId: true,
      serviceOrderId: true,
      user: { select: { name: true, email: true, phoneNumber: true } },
      verifiedBy: { select: { name: true, email: true } },
    },
  });

  const rows = payments.map((p) => ({
    "เลขที่บิล": p.paymentNo ?? p.id,
    "วันที่สร้าง": formatBangkokDateTime(p.createdAt),
    "วันที่ชำระ": formatBangkokDateTime(p.paidAt),
    "ประเภท": p.packageSaleId ? "ขายแพ็กเกจ" : "บริการซักผ้า",
    "ลูกค้า": p.user.name ?? "",
    "อีเมล": p.user.email,
    "เบอร์": p.user.phoneNumber ?? "",
    "ช่องทางชำระ": p.paymentMethod === "CASH" ? "เงินสด" : "โอน",
    "ยอด": Number(p.amount),
    "สถานะ": p.paidAt ? "ชำระแล้ว" : "รอตรวจสอบ",
    "ผู้ยืนยัน": p.verifiedBy?.name ?? "",
    "หมายเหตุ": p.note ?? "",
  }));

  const headers = [
    "เลขที่บิล", "วันที่สร้าง", "วันที่ชำระ", "ประเภท",
    "ลูกค้า", "อีเมล", "เบอร์",
    "ช่องทางชำระ", "ยอด", "สถานะ", "ผู้ยืนยัน", "หมายเหตุ",
  ];
  const csv = buildCsv(headers, rows);
  const fromTag = from.toISOString().slice(0, 10);
  const toTag = to.toISOString().slice(0, 10);
  return sendCsv(`sales-${fromTag}-to-${toTag}`, csv);
});
