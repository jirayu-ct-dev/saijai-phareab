const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;
const PICKUP_HOUR = 17;
const PICKUP_DAYS = [3, 6];
const EXPLICIT_TIMEZONE_PATTERN = /(Z|[+-]\d{2}:?\d{2})$/i;
const BANGKOK_LOCAL_DATE_TIME_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})(?:T|\s)(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/;
const BANGKOK_LOCAL_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

const toBangkok = (date: Date) => new Date(date.getTime() + BANGKOK_OFFSET_MS);
const fromBangkok = (bkk: Date) => new Date(bkk.getTime() - BANGKOK_OFFSET_MS);

const invalidDate = () => new Date(Number.NaN);

export function parseBangkokDateTime(value: string | null | undefined): Date | null {
  const input = value?.trim();
  if (!input) return null;

  if (EXPLICIT_TIMEZONE_PATTERN.test(input)) {
    return new Date(input);
  }

  const dateTimeMatch = input.match(BANGKOK_LOCAL_DATE_TIME_PATTERN);
  const dateMatch = dateTimeMatch ?? input.match(BANGKOK_LOCAL_DATE_PATTERN);
  if (!dateMatch) return invalidDate();

  const [, yearText, monthText, dayText, hourText = "00", minuteText = "00", secondText = "00", millisecondText = "0"] = dateMatch;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);
  const millisecond = Number(millisecondText.padEnd(3, "0"));

  if (
    month < 1 || month > 12
    || day < 1 || day > 31
    || hour < 0 || hour > 23
    || minute < 0 || minute > 59
    || second < 0 || second > 59
    || millisecond < 0 || millisecond > 999
  ) {
    return invalidDate();
  }

  const utcDate = new Date(Date.UTC(year, month - 1, day, hour, minute, second, millisecond) - BANGKOK_OFFSET_MS);
  const bangkokDate = toBangkok(utcDate);

  if (
    bangkokDate.getUTCFullYear() !== year
    || bangkokDate.getUTCMonth() + 1 !== month
    || bangkokDate.getUTCDate() !== day
    || bangkokDate.getUTCHours() !== hour
    || bangkokDate.getUTCMinutes() !== minute
    || bangkokDate.getUTCSeconds() !== second
    || bangkokDate.getUTCMilliseconds() !== millisecond
  ) {
    return invalidDate();
  }

  return utcDate;
}

export function parseBangkokDateBoundary(value: Date | string | null | undefined, boundary: "start" | "end"): Date | null {
  if (!value) return null;

  const instant = value instanceof Date ? value : parseBangkokDateTime(value);
  if (!instant || Number.isNaN(instant.getTime())) return invalidDate();

  const bangkokDate = toBangkok(instant);
  const year = bangkokDate.getUTCFullYear();
  const month = bangkokDate.getUTCMonth();
  const day = bangkokDate.getUTCDate();
  const time = boundary === "start"
    ? { hour: 0, minute: 0, second: 0, millisecond: 0 }
    : { hour: 23, minute: 59, second: 59, millisecond: 999 };

  return new Date(
    Date.UTC(year, month, day, time.hour, time.minute, time.second, time.millisecond) - BANGKOK_OFFSET_MS,
  );
}

export function computeNextPickup(from: Date = new Date()): Date {
  const bkk = toBangkok(from);

  for (let offset = 0; offset < 14; offset += 1) {
    const candidate = new Date(bkk.getTime());
    candidate.setUTCDate(candidate.getUTCDate() + offset);
    candidate.setUTCHours(PICKUP_HOUR, 0, 0, 0);

    const day = candidate.getUTCDay();
    if (!PICKUP_DAYS.includes(day)) continue;
    if (offset === 0 && candidate.getTime() <= bkk.getTime()) continue;

    return fromBangkok(candidate);
  }

  const fallback = new Date(bkk.getTime());
  fallback.setUTCDate(fallback.getUTCDate() + 7);
  fallback.setUTCHours(PICKUP_HOUR, 0, 0, 0);
  return fromBangkok(fallback);
}

export function isPickupDay(date: Date): boolean {
  const bkk = toBangkok(date);
  return PICKUP_DAYS.includes(bkk.getUTCDay());
}

export const PICKUP_TIME_LABEL = `${String(PICKUP_HOUR).padStart(2, "0")}:00`;
