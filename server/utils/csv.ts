const escapeCell = (value: unknown): string => {
  if (value === null || value === undefined) return "";
  let str = typeof value === "string" ? value : String(value);
  if (str.includes('"') || str.includes(",") || str.includes("\n") || str.includes("\r")) {
    str = `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

export const buildCsv = (headers: string[], rows: Array<Record<string, unknown>>): string => {
  const headerLine = headers.map(escapeCell).join(",");
  const bodyLines = rows.map((row) => headers.map((h) => escapeCell(row[h])).join(","));
  return "﻿" + [headerLine, ...bodyLines].join("\r\n");
};

export const sendCsv = (filename: string, csv: string) => {
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}.csv"`,
    },
  });
};

export const formatBangkokDateTime = (date: Date | string | null | undefined): string => {
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
};

export const parseDateRange = (from: unknown, to: unknown): { from: Date; to: Date } => {
  const fromStr = String(from ?? "").trim();
  const toStr = String(to ?? "").trim();
  const fromDate = fromStr ? new Date(fromStr) : new Date(Date.now() - 30 * 86400000);
  const toDate = toStr ? new Date(toStr) : new Date();
  if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
    throw createError({ statusCode: 400, statusMessage: "ช่วงเวลาไม่ถูกต้อง" });
  }
  toDate.setHours(23, 59, 59, 999);
  return { from: fromDate, to: toDate };
};
