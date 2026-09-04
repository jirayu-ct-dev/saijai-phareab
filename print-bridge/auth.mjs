import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const equalText = (left, right) => {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
};
export const tokenHash = (value) => createHash("sha256").update(value).digest("hex");
export const pairingCodeFor = (secret, nowMs, ttlSeconds) => {
  const slot = Math.floor(nowMs / (ttlSeconds * 1000));
  const bytes = createHmac("sha256", secret).update(`pair:${slot}`).digest();
  return String(bytes.readUInt32BE(0) % 1_000_000).padStart(6, "0");
};
export const validatePairingCode = (code, secret, nowMs, ttlSeconds) => /^\d{6}$/.test(code ?? "")
  && [nowMs, nowMs - ttlSeconds * 1000].some((time) => equalText(code, pairingCodeFor(secret, time, ttlSeconds)));
export const issueToken = (nowMs, ttlDays) => ({ token: randomBytes(32).toString("base64url"), expiresAt: new Date(nowMs + ttlDays * 86_400_000).toISOString() });
export const authenticateToken = (authorization, tokens, nowMs) => {
  const match = /^Bearer ([A-Za-z0-9_-]{43})$/.exec(authorization ?? "");
  if (!match) return false;
  const hash = tokenHash(match[1]);
  return tokens.some((entry) => entry.hash === hash && Date.parse(entry.expiresAt) > nowMs);
};
