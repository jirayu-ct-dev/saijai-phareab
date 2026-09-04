import type { H3Event } from "h3";

// Same default as the Better Auth trustedProxies config in app/utils/auth.ts.
const trustedProxies = (process.env.TRUSTED_PROXIES ?? "127.0.0.1,::1")
  .split(",")
  .map((entry) => entry.trim().replace(/^::ffff:/i, ""))
  .filter(Boolean);

const normalizeIp = (value: string) => value.trim().replace(/^::ffff:/i, "");

/**
 * Resolve a client IP that the caller cannot spoof, for rate limiting.
 * X-Forwarded-For is honored only when the direct peer is a trusted proxy, and
 * the chain is walked from the direct peer toward the client. This supports
 * multiple trusted proxies without collapsing every request onto the nearest
 * proxy address, while ignoring spoofed entries left of the first untrusted
 * hop.
 */
export const resolveRateLimitClientIp = (
  remoteAddress: string,
  forwarded: string | string[] | undefined,
  trusted: readonly string[],
): string => {
  const remote = normalizeIp(remoteAddress);
  if (!remote || !trusted.includes(remote) || !forwarded) {
    return remote || "unknown";
  }

  const entries = (Array.isArray(forwarded) ? forwarded.join(",") : forwarded)
    .split(",")
    .map(normalizeIp)
    .filter(Boolean);

  for (let index = entries.length - 1; index >= 0; index -= 1) {
    if (!trusted.includes(entries[index]!)) return entries[index]!;
  }

  return entries[0] ?? remote;
};

export const getRateLimitClientIp = (event: H3Event): string => {
  const remoteAddress = event.node.req.socket.remoteAddress ?? "";
  return resolveRateLimitClientIp(remoteAddress, event.node.req.headers["x-forwarded-for"], trustedProxies);
};
