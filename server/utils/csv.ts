import { parseBangkokDateBoundary } from "~~/shared/utils/pickup";

const escapeCell = (value: unknown): string => {
  if (value === null || value === undefined) return "";
  let str = typeof value === "string" ? value : String(value);
  // Neutralize spreadsheet formula injection: a leading =, +, -, @ or tab
  // would be interpreted as a formula by Excel/Google Sheets when exported.
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  if (str.includes('"') || str.includes(",") || str.includes("\n") || str.includes("\r")) {
    str = `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

export function buildCsv(headers: string[], rows: Array<Record<string, unknown>>): string {
  const headerLine = headers.map(escapeCell).join(",");
  const bodyLines = rows.map((row) => headers.map((h) => escapeCell(row[h])).join(","));
  return "﻿" + [headerLine, ...bodyLines].join("\r\n");
}

export function sendCsv(filename: string, csv: string) {
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}.csv"`,
    },
  });
}

export function formatBangkokDateTime(date: Date | string | null | undefined): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  const offsetMs = 7 * 60 * 60 * 1000;
  const bkk = new Date(d.getTime() + offsetMs);
  const yyyy = bkk.getUTCFullYear();
  const mm = String(bkk.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(bkk.getUTCDate()).padStart(2, "0");
  const hh = String(bkk.getUTCHours()).padStart(2, "0");
  const mi = String(bkk.getUTCMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
}

export function formatBangkokDateTag(date: Date | string | null | undefined): string {
  return formatBangkokDateTime(date).slice(0, 10);
}

const MAX_RANGE_DAYS = 366;
const DAY_MS = 86_400_000;

// createError is Nitro auto-imported at runtime; fall back to a plain error
// when this module is exercised outside Nitro (unit tests).
function badDateRange(statusMessage: string): never {
  if (typeof createError === "function") {
    throw createError({ statusCode: 400, statusMessage });
  }
  throw new Error(statusMessage);
}

export function parseDateRange(from: unknown, to: unknown): { from: Date; to: Date } {
  const fromStr = String(from ?? "").trim();
  const toStr = String(to ?? "").trim();

  const fromDate = parseBangkokDateBoundary(fromStr || new Date(Date.now() - 30 * 86400000), "start");
  const toDate = parseBangkokDateBoundary(toStr || new Date(), "end");
  if (!fromDate || !toDate || Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
    badDateRange("ช่วงเวลาไม่ถูกต้อง");
  }
  if (fromDate.getTime() > toDate.getTime()) {
    badDateRange("ช่วงเวลาไม่ถูกต้อง (วันเริ่มต้นอยู่หลังวันสิ้นสุด)");
  }
  // Chart/export endpoints iterate per day across the range; an unbounded
  // range would let one request force a near-infinite loop.
  if (toDate.getTime() - fromDate.getTime() > MAX_RANGE_DAYS * DAY_MS) {
    badDateRange("ช่วงเวลาต้องไม่เกิน 366 วัน");
  }
  return { from: fromDate, to: toDate };
}
