import { prisma } from "~~/server/utils/prisma";
import { requireRole } from "~~/server/utils/auth";
import { buildCsv, parseDateRange, sendCsv } from "~~/server/utils/csv";

export default defineEventHandler(async (event) => {
  requireRole(event, ["ADMIN"]);

  const query = getQuery(event);
  const { from, to } = parseDateRange(query.from, query.to);

  const employees = await prisma.user.findMany({
    where: { deletedAt: null, role: { in: ["ADMIN", "EMPLOYEE"] } },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      employeeServiceOrders: {
        where: { deletedAt: null, receivedAt: { gte: from, lte: to } },
        select: {
          totalAmount: true,
          status: true,
          serviceOrderItems: { where: { deletedAt: null }, select: { quantity: true } },
        },
      },
    },
  });

  const rows = employees.map((u) => {
    const orders = u.employeeServiceOrders;
    const totalOrders = orders.length;
    const completed = orders.filter((o) => o.status === "COMPLETED").length;
    const cancelled = orders.filter((o) => o.status === "CANCELLED").length;
    const totalQty = orders.reduce(
      (s, o) => s + o.serviceOrderItems.reduce((q, it) => q + it.quantity, 0),
      0,
    );
    const totalRevenue = orders
      .filter((o) => o.status !== "CANCELLED")
      .reduce((s, o) => s + (o.totalAmount != null ? Number(o.totalAmount) : 0), 0);

    return {
      "พนักงาน": u.name ?? "",
      "อีเมล": u.email,
      "Role": u.role === "ADMIN" ? "ผู้ดูแล" : "พนักงาน",
      "ออเดอร์ทั้งหมด": totalOrders,
      "เสร็จสิ้น": completed,
      "ยกเลิก": cancelled,
      "จำนวนชิ้นรวม": totalQty,
      "ยอดที่รับผิดชอบ": totalRevenue,
    };
  });

  const headers = [
    "พนักงาน", "อีเมล", "Role",
    "ออเดอร์ทั้งหมด", "เสร็จสิ้น", "ยกเลิก",
    "จำนวนชิ้นรวม", "ยอดที่รับผิดชอบ",
  ];
  const csv = buildCsv(headers, rows);
  const fromTag = from.toISOString().slice(0, 10);
  const toTag = to.toISOString().slice(0, 10);
  return sendCsv(`employee-performance-${fromTag}-to-${toTag}`, csv);
});
