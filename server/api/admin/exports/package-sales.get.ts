import { prisma } from "~~/server/utils/prisma";
import { requireRole } from "~~/server/utils/auth";
import { buildCsv, formatBangkokDateTag, formatBangkokDateTime, parseDateRange, sendCsv } from "~~/server/utils/csv";
import { paymentStatusLabels } from "~~/shared/config/paymentConfig";
import { isInternalCustomerEmail } from "~~/server/utils/customerAccount";

export default defineEventHandler(async (event) => {
  requireRole(event, ["ADMIN"]);

  const query = getQuery(event);
  const { from, to } = parseDateRange(query.from, query.to);

  const sales = await prisma.packageSale.findMany({
    where: { deletedAt: null, createdAt: { gte: from, lte: to } },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      createdAt: true,
      subtotalAmount: true,
      discountAmount: true,
      totalAmount: true,
      note: true,
      items: {
        select: { qty: true, product: { select: { name: true, packageType: true } } },
      },
      customer: { select: { name: true, email: true, phoneNumber: true } },
      soldBy: { select: { name: true, email: true } },
      payments: { select: { status: true, method: true, paidAt: true } },
    },
  });

  const rows = sales.map((s) => {
    const payment = s.payments[0] ?? null;
    return {
      "รหัสรายการ": s.id,
      "วันที่ขาย": formatBangkokDateTime(s.createdAt),
      "ลูกค้า": s.customer.name ?? "",
      "อีเมล": isInternalCustomerEmail(s.customer.email) ? "" : s.customer.email,
      "เบอร์": s.customer.phoneNumber ?? "",
      "รายการแพ็กเกจ": s.items
        .map((item) => `${item.product.name} × ${item.qty}`)
        .join(", "),
      "ราคารวม": Number(s.subtotalAmount),
      "ส่วนลด": Number(s.discountAmount),
      "ยอดสุทธิ": Number(s.totalAmount),
      "สถานะชำระเงิน": payment ? paymentStatusLabels[payment.status] : "",
      "วิธีชำระเงิน": payment?.method === "CASH" ? "เงินสด" : payment?.method === "TRANSFER" ? "โอนเงิน" : "",
      "วันที่ชำระ": formatBangkokDateTime(payment?.paidAt ?? null),
      "ผู้ขาย": s.soldBy?.name || s.soldBy?.email || "",
      "หมายเหตุ": s.note ?? "",
    };
  });

  const headers = [
    "รหัสรายการ", "วันที่ขาย",
    "ลูกค้า", "อีเมล", "เบอร์",
    "รายการแพ็กเกจ",
    "ราคารวม", "ส่วนลด", "ยอดสุทธิ",
    "สถานะชำระเงิน", "วิธีชำระเงิน", "วันที่ชำระ",
    "ผู้ขาย", "หมายเหตุ",
  ];
  const csv = buildCsv(headers, rows);
  const fromTag = formatBangkokDateTag(from);
  const toTag = formatBangkokDateTag(to);
  return sendCsv(`package-sales-${fromTag}-to-${toTag}`, csv);
});
