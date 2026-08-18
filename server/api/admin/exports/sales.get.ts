import { prisma } from "~~/server/utils/prisma";
import { requireRole } from "~~/server/utils/auth";
import { buildCsv, formatBangkokDateTag, formatBangkokDateTime, parseDateRange, sendCsv } from "~~/server/utils/csv";
import { paymentMethodLabels } from "~~/shared/config/paymentConfig";
import { isInternalCustomerEmail } from "~~/server/utils/customerAccount";

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
      method: true,
      amount: true,
      note: true,
      packageSaleId: true,
      serviceOrderId: true,
      user: { select: { name: true, email: true, phoneNumber: true } },
    },
  });

  const rows = payments.map((p) => ({
    "เลขที่บิล": p.paymentNo ?? p.id,
    "วันที่สร้าง": formatBangkokDateTime(p.createdAt),
    "วันที่ชำระ": formatBangkokDateTime(p.paidAt),
    "วิธีชำระเงิน": p.method ? paymentMethodLabels[p.method] : "",
    "ประเภท": p.packageSaleId ? "ขายแพ็กเกจ" : "บริการซักผ้า",
    "ลูกค้า": p.user.name ?? "",
    "อีเมล": isInternalCustomerEmail(p.user.email) ? "" : p.user.email,
    "เบอร์": p.user.phoneNumber ?? "",
    "ยอด": Number(p.amount),
    "หมายเหตุ": p.note ?? "",
  }));

  const headers = [
    "เลขที่บิล", "วันที่สร้าง", "วันที่ชำระ", "วิธีชำระเงิน", "ประเภท",
    "ลูกค้า", "อีเมล", "เบอร์",
    "ยอด", "หมายเหตุ",
  ];
  const csv = buildCsv(headers, rows);
  const fromTag = formatBangkokDateTag(from);
  const toTag = formatBangkokDateTag(to);
  return sendCsv(`sales-${fromTag}-to-${toTag}`, csv);
});
