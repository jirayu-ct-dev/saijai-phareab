const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 20;
const attempts = new Map<string, { count: number; resetAt: number }>();

export function enforceCustomerClaimRateLimit(key: string, now = Date.now()) {
  const current = attempts.get(key);
  if (!current || current.resetAt <= now) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return;
  }
  if (current.count >= MAX_ATTEMPTS) {
    throw createError({ statusCode: 429, statusMessage: "ลองหลายครั้งเกินไป กรุณารอสักครู่" });
  }
  current.count += 1;

  if (attempts.size > 5_000) {
    for (const [entryKey, value] of attempts) {
      if (value.resetAt <= now) attempts.delete(entryKey);
    }
  }
}
