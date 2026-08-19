import { prisma } from "~~/server/utils/prisma";
import { requireRole } from "~~/server/utils/auth";
import { isInternalCustomerEmail } from "~~/server/utils/customerAccount";
import { buildCsv, formatBangkokDateTag, formatBangkokDateTime, parseDateRange, sendCsv } from "~~/server/utils/csv";

export default defineEventHandler(async (event) => {
  requireRole(event, ["ADMIN"]);
  const query = getQuery(event);
  const { from, to } = parseDateRange(query.from, query.to);
  const customers = await prisma.user.findMany({
    where: {
      role: "USER",
      deletedAt: null,
      createdAt: { gte: from, lte: to },
      AND: [
        { OR: [{ normalizedPhoneNumber: null }, { NOT: { normalizedPhoneNumber: { startsWith: "000000" } } }] },
        { OR: [{ name: null }, { NOT: { name: { startsWith: "ลูกค้าเดิมไม่ระบุ" } } }] },
      ],
    },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      phoneNumber: true,
      customerAccountStatus: true,
      claimedAt: true,
      isActive: true,
      createdAt: true,
      accounts: { where: { providerId: "line" }, select: { id: true }, take: 1 },
      _count: { select: { serviceOrders: true, memberEntitlements: true } },
    },
  });
  const rows = customers.map((customer) => ({
    "รหัสลูกค้า": customer.id,
    "ชื่อ": customer.name ?? "",
    "อีเมล": isInternalCustomerEmail(customer.email) ? "" : customer.email,
    "เบอร์โทร": customer.phoneNumber ?? "",
    "สถานะบัญชี": customer.customerAccountStatus === "OFFLINE" ? "ยังไม่เปิดใช้งาน" : "เปิดใช้งานแล้ว",
    "ผูก LINE": customer.accounts.length ? "ใช่" : "ไม่ใช่",
    "ใช้งานบัญชี": customer.isActive ? "ใช่" : "ไม่ใช่",
    "จำนวนออเดอร์": customer._count.serviceOrders,
    "จำนวนสิทธิ์แพ็กเกจ": customer._count.memberEntitlements,
    "วันที่เปิดใช้งาน": formatBangkokDateTime(customer.claimedAt),
    "วันที่สร้าง": formatBangkokDateTime(customer.createdAt),
  }));
  const headers = ["รหัสลูกค้า", "ชื่อ", "อีเมล", "เบอร์โทร", "สถานะบัญชี", "ผูก LINE", "ใช้งานบัญชี", "จำนวนออเดอร์", "จำนวนสิทธิ์แพ็กเกจ", "วันที่เปิดใช้งาน", "วันที่สร้าง"];
  return sendCsv(`customers-${formatBangkokDateTag(from)}-to-${formatBangkokDateTag(to)}`, buildCsv(headers, rows));
});
