import { createRateLimiter, type RateLimiter } from "~~/server/utils/rateLimit";

const limiter: RateLimiter = createRateLimiter({
  windowMs: 10 * 60 * 1000,
  max: 20,
});

export function enforceCustomerClaimRateLimit(key: string, now = Date.now()) {
  if (!limiter.check(key, now)) {
    throw createError({ statusCode: 429, statusMessage: "ลองหลายครั้งเกินไป กรุณารอสักครู่" });
  }
}
