import { prisma } from "~~/server/utils/prisma";
import { requireRole } from "~~/server/utils/auth";
import { buildCsv, formatBangkokDateTime, parseDateRange, sendCsv } from "~~/server/utils/csv";

const statusLabel: Record<string, string> = {
  RECEIVED: "รับผ้าแล้ว",
  PROCESSING: "กำลังดำเนินการ",
  DELIVERING: "พร้อมส่ง",
  COMPLETED: "เสร็จสิ้น",
  CANCELLED: "ยกเลิก",
};

const deductOnLabel: Record<string, string> = {
  CREATED: "ตอนสร้างรายการ",
  COMPLETED: "ตอนงานเสร็จ",
};

export default defineEventHandler(async (event) => {
  requireRole(event, ["ADMIN"]);

  const query = getQuery(event);
  const { from, to } = parseDateRange(query.from, query.to);

  const usages = await prisma.serviceOrderAddonUsage.findMany({
    where: {
      serviceOrder: {
        deletedAt: null,
        receivedAt: { gte: from, lte: to },
      },
    },
    orderBy: [
      { serviceOrder: { receivedAt: "asc" } },
      { createdAt: "asc" },
    ],
    select: {
      id: true,
      productName: true,
      credits: true,
      deductOn: true,
      deductedAt: true,
      refundedAt: true,
      createdAt: true,
      serviceOrder: {
        select: {
          id: true,
          orderNo: true,
          status: true,
          receivedAt: true,
          customer: { select: { name: true, email: true, phoneNumber: true } },
          employee: { select: { name: true, email: true } },
          memberEntitlement: { select: { product: { select: { name: true } } } },
        },
      },
      memberEntitlement: { select: { product: { select: { name: true } } } },
    },
  });

  const rows = usages.map((u) => ({
    "เลขรับผ้า": u.serviceOrder.orderNo ?? u.serviceOrder.id,
    "วันที่รับผ้า": formatBangkokDateTime(u.serviceOrder.receivedAt),
    "ลูกค้า": u.serviceOrder.customer.name ?? "",
    "อีเมล": u.serviceOrder.customer.email,
    "เบอร์": u.serviceOrder.customer.phoneNumber ?? "",
    "สถานะงาน": statusLabel[u.serviceOrder.status] ?? u.serviceOrder.status,
    "แพ็กเกจหลัก": u.serviceOrder.memberEntitlement?.product.name ?? u.memberEntitlement?.product.name ?? "",
    "แพ็กเกจเสริม": u.productName || "แพ็กเกจเสริม",
    "เครดิตที่ใช้": Number(u.credits ?? 0),
    "หักเครดิตเมื่อ": deductOnLabel[u.deductOn] ?? u.deductOn,
    "วันที่หัก": formatBangkokDateTime(u.deductedAt),
    "วันที่คืนเครดิต": formatBangkokDateTime(u.refundedAt),
    "พนักงาน": u.serviceOrder.employee?.name || u.serviceOrder.employee?.email || "",
    "วันที่สร้างข้อมูล": formatBangkokDateTime(u.createdAt),
  }));

  const headers = [
    "เลขรับผ้า", "วันที่รับผ้า", "ลูกค้า", "อีเมล", "เบอร์",
    "สถานะงาน", "แพ็กเกจหลัก", "แพ็กเกจเสริม", "เครดิตที่ใช้",
    "หักเครดิตเมื่อ", "วันที่หัก", "วันที่คืนเครดิต",
    "พนักงาน", "วันที่สร้างข้อมูล",
  ];

  const csv = buildCsv(headers, rows);
  const fromTag = from.toISOString().slice(0, 10);
  const toTag = to.toISOString().slice(0, 10);
  return sendCsv(`addon-usages-${fromTag}-to-${toTag}`, csv);
});
