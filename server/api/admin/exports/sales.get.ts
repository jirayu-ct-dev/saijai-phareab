import { prisma } from "~~/server/utils/prisma";
import { requireRole } from "~~/server/utils/auth";
import { buildCsv, formatBangkokDateTag, formatBangkokDateTime, parseDateRange, sendCsv } from "~~/server/utils/csv";
import { paymentMethodLabels, paymentStatusLabels } from "~~/shared/config/paymentConfig";
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
      receiptNo: true,
      createdAt: true,
      paidAt: true,
      status: true,
      method: true,
      amount: true,
      note: true,
      packageSaleId: true,
      serviceOrderId: true,
      packageSale: {
        select: {
          items: { select: { qty: true, product: { select: { name: true } } } },
        },
      },
      serviceOrder: {
        select: {
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
      },
      user: { select: { name: true, email: true, phoneNumber: true } },
    },
  });

  const formatServiceOrderItems = (items: Array<{
    quantity: number;
    storefrontPrice: { storefrontItem: { name: string }; storefrontService: { name: string } } | null;
  }>) =>
    items
      .map((item) => {
        const name = item.storefrontPrice
          ? `${item.storefrontPrice.storefrontItem.name} (${item.storefrontPrice.storefrontService.name})`
          : "รายการไม่ระบุ";
        return `${name} × ${item.quantity}`;
      })
      .join(", ");

  const rows = payments.map((p) => {
    const itemSummary = p.packageSale
      ? p.packageSale.items.map((item) => `${item.product.name} × ${item.qty}`).join(", ")
      : p.serviceOrder
        ? formatServiceOrderItems(p.serviceOrder.serviceOrderItems)
        : "";
    return {
      "เลขที่บิล": p.paymentNo ?? p.id,
      "เลขที่ใบเสร็จ": p.receiptNo ?? "",
      "วันที่สร้าง": formatBangkokDateTime(p.createdAt),
      "วันที่ชำระ": formatBangkokDateTime(p.paidAt),
      "สถานะชำระเงิน": p.status ? paymentStatusLabels[p.status] : "",
      "วิธีชำระเงิน": p.method ? paymentMethodLabels[p.method] : "",
      "ประเภท": p.packageSaleId ? "ขายแพ็กเกจ" : "บริการซักผ้า",
      "รายการ": itemSummary,
      "ลูกค้า": p.user.name ?? "",
      "อีเมล": isInternalCustomerEmail(p.user.email) ? "" : p.user.email,
      "เบอร์": p.user.phoneNumber ?? "",
      "ยอด": Number(p.amount),
      "หมายเหตุ": p.note ?? "",
    };
  });

  const headers = [
    "เลขที่บิล", "เลขที่ใบเสร็จ", "วันที่สร้าง", "วันที่ชำระ", "สถานะชำระเงิน", "วิธีชำระเงิน",
    "ประเภท", "รายการ",
    "ลูกค้า", "อีเมล", "เบอร์",
    "ยอด", "หมายเหตุ",
  ];
  const csv = buildCsv(headers, rows);
  const fromTag = formatBangkokDateTag(from);
  const toTag = formatBangkokDateTag(to);
  return sendCsv(`sales-${fromTag}-to-${toTag}`, csv);
});
