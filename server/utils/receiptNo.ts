import { prisma } from "./prisma";

const BANGKOK_TIMEZONE = "Asia/Bangkok";

const getBangkokYear = (date = new Date()) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: BANGKOK_TIMEZONE,
    year: "numeric",
  }).format(date);

const padSeq = (n: number) => n.toString().padStart(4, "0");

export const createReceiptNo = async (date = new Date()) => {
  const { getBusinessSetting } = await import("./businessSetting");
  const setting = (await getBusinessSetting()) as { receiptNoPrefix?: string };
  const prefix = setting.receiptNoPrefix || "RC-";
  const year = getBangkokYear(date);
  const yearPrefix = `${prefix}${year}-`;

  const last = await prisma.paymentRecord.findFirst({
    where: { receiptNo: { startsWith: yearPrefix } },
    orderBy: { receiptNo: "desc" },
    select: { receiptNo: true },
  });

  const lastSeq = last?.receiptNo ? parseInt(last.receiptNo.slice(yearPrefix.length), 10) : 0;
  return `${yearPrefix}${padSeq((Number.isFinite(lastSeq) ? lastSeq : 0) + 1)}`;
};
