import { prisma } from "./prisma";

type TxClient = Omit<typeof prisma, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">;

const BANGKOK_TIMEZONE = "Asia/Bangkok";

const getBangkokYear = (date = new Date()) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: BANGKOK_TIMEZONE,
    year: "numeric",
  }).format(date);

const padSeq = (n: number) => n.toString().padStart(4, "0");

export const createQuotationNo = async (date = new Date(), quotationTxClient?: TxClient) => {
  const db = quotationTxClient ?? prisma;
  const { getBusinessSetting } = await import("./appSetting");
  const setting = (await getBusinessSetting()) as { quotationNoPrefix?: string };
  const prefix = setting.quotationNoPrefix || "QT-";
  const year = getBangkokYear(date);
  const yearPrefix = `${prefix}${year}-`;

  const last = await db.serviceOrder.findFirst({
    where: { quotationNo: { startsWith: yearPrefix } },
    orderBy: { quotationNo: "desc" },
    select: { quotationNo: true },
  });

  const lastSeq = last?.quotationNo ? parseInt(last.quotationNo.slice(yearPrefix.length), 10) : 0;
  return `${yearPrefix}${padSeq((Number.isFinite(lastSeq) ? lastSeq : 0) + 1)}`;
};
