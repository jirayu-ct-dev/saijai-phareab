const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;
const PICKUP_HOUR = 17;
const PICKUP_DAYS = [3, 6];

const toBangkok = (date: Date) => new Date(date.getTime() + BANGKOK_OFFSET_MS);
const fromBangkok = (bkk: Date) => new Date(bkk.getTime() - BANGKOK_OFFSET_MS);

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
