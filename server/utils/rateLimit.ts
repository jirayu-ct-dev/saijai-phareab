type RateLimiterOptions = {
  windowMs: number;
  max: number;
  maxTrackedKeys?: number;
};

export type RateLimiter = {
  /** Returns false when the key exceeded the limit within the window. */
  check(key: string, now?: number): boolean;
  /** Test helper: forget all recorded attempts. */
  reset(): void;
};

/**
 * Lightweight in-memory fixed-window rate limiter, sufficient for the current
 * single-instance deployment. Keys are caller-defined (IP, user id, ...).
 * Callers translate a false result into their own 429 error.
 */
export function createRateLimiter(options: RateLimiterOptions): RateLimiter {
  const attempts = new Map<string, { count: number; resetAt: number }>();
  const maxTrackedKeys = options.maxTrackedKeys ?? 5_000;

  return {
    check(key: string, now: number = Date.now()): boolean {
      const current = attempts.get(key);
      if (!current || current.resetAt <= now) {
        attempts.set(key, { count: 1, resetAt: now + options.windowMs });
        return true;
      }
      if (current.count >= options.max) {
        return false;
      }
      current.count += 1;

      if (attempts.size > maxTrackedKeys) {
        for (const [entryKey, value] of attempts) {
          if (value.resetAt <= now) attempts.delete(entryKey);
        }
      }
      return true;
    },
    reset(): void {
      attempts.clear();
    },
  };
}
