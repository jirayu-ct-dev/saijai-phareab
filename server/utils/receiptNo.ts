import { prisma } from "./prisma";

type TxClient = Omit<typeof prisma, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">;

const BANGKOK_TIMEZONE = "Asia/Bangkok";

const getBangkokYear = (date = new Date()) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: BANGKOK_TIMEZONE,
    year: "numeric",
  }).format(date);

const padSeq = (n: number) => n.toString().padStart(4, "0");

// Lexicographic ordering of receipt numbers breaks once the yearly sequence
// passes 9999 ("RC-2026-10000" sorts before "RC-2026-9999"), which would
// forever regenerate an already-used number. From this threshold on, fall
// back to a numeric scan of the year's receipt numbers.
const SEQ_SCAN_THRESHOLD = 9990;

const resolveLastSeq = async (
  db: TxClient,
  yearPrefix: string,
  lexicographicLast: string | null,
) => {
  let lastSeq = lexicographicLast ? parseInt(lexicographicLast.slice(yearPrefix.length), 10) : 0;
  lastSeq = Number.isFinite(lastSeq) ? lastSeq : 0;
  if (lastSeq < SEQ_SCAN_THRESHOLD) return lastSeq;

  const rows = await db.paymentRecord.findMany({
    where: { receiptNo: { startsWith: yearPrefix } },
    select: { receiptNo: true },
  });
  for (const row of rows) {
    if (!row.receiptNo) continue;
    const seq = parseInt(row.receiptNo.slice(yearPrefix.length), 10);
    if (Number.isFinite(seq) && seq > lastSeq) lastSeq = seq;
  }
  return lastSeq;
};

export const createReceiptNo = async (date = new Date(), receiptTxClient?: TxClient) => {
  const db = receiptTxClient ?? prisma;
  const { getBusinessSetting } = await import("./appSetting");
  const setting = (await getBusinessSetting()) as { receiptNoPrefix?: string };
  const prefix = setting.receiptNoPrefix || "RC-";
  const year = getBangkokYear(date);
  const yearPrefix = `${prefix}${year}-`;

  const last = await db.paymentRecord.findFirst({
    where: { receiptNo: { startsWith: yearPrefix } },
    orderBy: { receiptNo: "desc" },
    select: { receiptNo: true },
  });

  const lastSeq = await resolveLastSeq(db, yearPrefix, last?.receiptNo ?? null);
  return `${yearPrefix}${padSeq(lastSeq + 1)}`;
};
