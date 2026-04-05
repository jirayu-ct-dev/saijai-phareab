import { format, isSameYear } from "date-fns";
import { th } from "date-fns/locale";
import type { Period } from "../types/dashboard";

const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;

export const THAI_MONTHS = [
  "ม.ค.",
  "ก.พ.",
  "มี.ค.",
  "เม.ย.",
  "พ.ค.",
  "มิ.ย.",
  "ก.ค.",
  "ส.ค.",
  "ก.ย.",
  "ต.ค.",
  "พ.ย.",
  "ธ.ค.",
];

const toValidDate = (value: Date | string): Date | null => {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const toBangkokDate = (value: Date | string): Date | null => {
  const source = toValidDate(value);
  if (!source) return null;
  return new Date(source.getTime() + BANGKOK_OFFSET_MS);
};

const padTwoDigits = (value: number) => value.toString().padStart(2, "0");

const formatInteger = (value: number) => {
  const sign = value < 0 ? "-" : "";
  const digits = Math.abs(Math.trunc(value)).toString();
  return `${sign}${digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
};

export function formatCurrency(amount: number): string {
  return `฿${formatInteger(Math.round(amount))}`;
}

export function formatNumber(amount: number): string {
  return formatInteger(Math.round(amount));
}

export function formatDateTime(value: Date | string): string {
  const bangkokDate = toBangkokDate(value);
  if (!bangkokDate) return "-";

  const day = bangkokDate.getUTCDate();
  const month = THAI_MONTHS[bangkokDate.getUTCMonth()];
  const year = bangkokDate.getUTCFullYear() + 543;
  const hour = padTwoDigits(bangkokDate.getUTCHours());
  const minute = padTwoDigits(bangkokDate.getUTCMinutes());

  return `${day} ${month} ${year} ${hour}:${minute} น.`;
}

export function formatDate(value: Date | string): string {
  const bangkokDate = toBangkokDate(value);
  if (!bangkokDate) return "-";

  const day = bangkokDate.getUTCDate();
  const month = THAI_MONTHS[bangkokDate.getUTCMonth()];
  const year = bangkokDate.getUTCFullYear() + 543;

  return `${day} ${month} ${year}`;
}

export function formatDateByPeriod(date: Date, period: Period): string {
  const isCurrentYear = isSameYear(date, new Date());

  switch (period) {
    case "daily":
      return format(date, isCurrentYear ? "d MMM" : "d MMM yy", { locale: th });

    case "weekly":
      return format(date, isCurrentYear ? "d MMM" : "d MMM yy", { locale: th });

    case "monthly":
      return format(date, isCurrentYear ? "MMM" : "MMM yy", { locale: th });

    default:
      return format(date, "d MMM yy", { locale: th });
  }
}

export const formatCredits = (credits: number | null | undefined): string => {
  const value = credits ?? 0;
  return value > 0 ? formatInteger(value) : "—";
};

export const formatDays = (days: number | null | undefined): string => {
  return days ? `${days} วัน` : "—";
};
