import { prisma } from "~~/server/utils/prisma";
import { requireRole } from "~~/server/utils/auth";
import { buildCsv, formatBangkokDateTag, formatBangkokDateTime, parseDateRange, sendCsv } from "~~/server/utils/csv";

export default defineEventHandler(async (event) => {
  requireRole(event, ["ADMIN"]);
  const query = getQuery(event);
  const { from, to } = parseDateRange(query.from, query.to);
  const expenses = await prisma.expense.findMany({
    where: { deletedAt: null, expenseAt: { gte: from, lte: to } },
    orderBy: [{ expenseAt: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      expenseAt: true,
      amount: true,
      description: true,
      createdAt: true,
      category: { select: { name: true } },
      createdBy: { select: { name: true, email: true } },
    },
  });
  const rows = expenses.map((expense) => ({
    "รหัสรายการ": expense.id,
    "วันที่รายจ่าย": formatBangkokDateTime(expense.expenseAt),
    "หมวดหมู่": expense.category.name,
    "จำนวนเงิน": Number(expense.amount),
    "รายละเอียด": expense.description ?? "",
    "ผู้บันทึก": expense.createdBy.name || expense.createdBy.email,
    "วันที่บันทึก": formatBangkokDateTime(expense.createdAt),
  }));
  const headers = ["รหัสรายการ", "วันที่รายจ่าย", "หมวดหมู่", "จำนวนเงิน", "รายละเอียด", "ผู้บันทึก", "วันที่บันทึก"];
  return sendCsv(`expenses-${formatBangkokDateTag(from)}-to-${formatBangkokDateTag(to)}`, buildCsv(headers, rows));
});
