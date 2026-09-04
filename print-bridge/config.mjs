import { stat } from "node:fs/promises";
import net from "node:net";

const ENV_KEYS = new Set([
  "PRINT_GATEWAY_BIND_HOST", "PRINT_GATEWAY_PORT", "PRINT_GATEWAY_PUBLIC_URL",
  "PRINT_GATEWAY_ALLOWED_ORIGINS", "PRINT_GATEWAY_DISCOVERY_CIDRS",
  "PRINT_GATEWAY_DISCOVERY_PORTS", "PRINT_GATEWAY_DISCOVERY_TIMEOUT_MS",
  "PRINT_GATEWAY_DISCOVERY_CONCURRENCY", "PRINT_GATEWAY_RESCAN_TTL_MS",
  "PRINT_GATEWAY_PAIRING_SECRET", "PRINT_GATEWAY_PAIRING_CODE_TTL_SECONDS",
  "PRINT_GATEWAY_TOKEN_TTL_DAYS", "PRINT_GATEWAY_MAX_PAYLOAD_BYTES",
  "PRINT_GATEWAY_TCP_TIMEOUT_MS", "PRINT_GATEWAY_STATE_PATH",
  "PRINT_GATEWAY_DEBUG_BYTES",
  "PRINT_GATEWAY_TLS_CERT_PATH", "PRINT_GATEWAY_TLS_KEY_PATH",
]);

const required = (env, key) => {
  const value = env[key]?.trim();
  if (!value) throw new Error(`${key} is required`);
  return value;
};

const integer = (env, key, fallback, { min = 1, max = Number.MAX_SAFE_INTEGER } = {}) => {
  const value = env[key]?.trim() || String(fallback);
  if (!/^\d+$/.test(value)) throw new Error(`${key} must be an integer`);
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) {
    throw new Error(`${key} must be between ${min} and ${max}`);
  }
  return parsed;
};

const origin = (value, key) => {
  let parsed;
  try { parsed = new URL(value); } catch { throw new Error(`${key} must be an absolute http(s) origin`); }
  if (!["http:", "https:"].includes(parsed.protocol) || parsed.origin !== value) {
    throw new Error(`${key} must be an absolute http(s) origin without path, query or hash`);
  }
  return parsed;
};

const csv = (env, key) => required(env, key).split(",").map((value) => value.trim()).filter(Boolean);
const ipv4Number = (address) => {
  if (net.isIPv4(address) === 0) throw new Error(`Invalid IPv4 address: ${address}`);
  return address.split(".").reduce((total, octet) => ((total << 8) | Number(octet)) >>> 0, 0);
};

export const isLoopbackHost = (host) => host === "localhost" || host === "::1" || host.startsWith("127.");

export function parsePrivateIpv4Cidr(value) {
  const [address, prefixText, ...rest] = value.split("/");
  if (rest.length > 0 || !address || !prefixText || !/^\d+$/.test(prefixText)) throw new Error(`Invalid discovery CIDR: ${value}`);
  const prefix = Number(prefixText);
  if (prefix < 24 || prefix > 32) throw new Error(`Discovery CIDR must be /24 through /32: ${value}`);
  const ip = ipv4Number(address);
  const first = ip >>> 24;
  const second = (ip >>> 16) & 255;
  const isPrivate = first === 10 || (first === 172 && second >= 16 && second <= 31)
    || (first === 192 && second === 168) || first === 127;
  if (!isPrivate) throw new Error(`Discovery CIDR must be private or loopback: ${value}`);
  const mask = prefix === 32 ? 0xffffffff : (0xffffffff << (32 - prefix)) >>> 0;
  const network = (ip & mask) >>> 0;
  if (network !== ip) throw new Error(`Discovery CIDR must use its network address: ${value}`);
  return { value, network, prefix, size: 2 ** (32 - prefix) };
}

export function validateEnvironment(env) {
  const bindHost = required(env, "PRINT_GATEWAY_BIND_HOST");
  if (!(net.isIP(bindHost) || bindHost === "localhost")) throw new Error("PRINT_GATEWAY_BIND_HOST must be an IP address or localhost");
  const publicUrl = origin(required(env, "PRINT_GATEWAY_PUBLIC_URL"), "PRINT_GATEWAY_PUBLIC_URL");
  const loopback = isLoopbackHost(publicUrl.hostname);
  const tlsCertPath = env.PRINT_GATEWAY_TLS_CERT_PATH?.trim() || null;
  const tlsKeyPath = env.PRINT_GATEWAY_TLS_KEY_PATH?.trim() || null;
  if (!loopback && (publicUrl.protocol !== "https:" || !tlsCertPath || !tlsKeyPath)) {
    throw new Error("Non-loopback Gateway requires HTTPS and both TLS certificate paths");
  }
  if ((tlsCertPath === null) !== (tlsKeyPath === null)) throw new Error("Both TLS certificate paths are required together");
  const allowedOrigins = csv(env, "PRINT_GATEWAY_ALLOWED_ORIGINS").map((value) => origin(value, "PRINT_GATEWAY_ALLOWED_ORIGINS").origin);
  if (new Set(allowedOrigins).size !== allowedOrigins.length) throw new Error("PRINT_GATEWAY_ALLOWED_ORIGINS contains duplicates");
  if (!loopback && allowedOrigins.some((value) => {
    const parsed = new URL(value);
    return parsed.protocol !== "https:" && !isLoopbackHost(parsed.hostname);
  })) throw new Error("Non-loopback Gateway requires HTTPS app origins");
  const discoveryCidrs = csv(env, "PRINT_GATEWAY_DISCOVERY_CIDRS").map(parsePrivateIpv4Cidr);
  const discoveryPorts = csv(env, "PRINT_GATEWAY_DISCOVERY_PORTS").map((value) => {
    if (!/^\d+$/.test(value)) throw new Error("PRINT_GATEWAY_DISCOVERY_PORTS must contain integer ports");
    const port = Number(value);
    if (port < 1 || port > 65535) throw new Error("PRINT_GATEWAY_DISCOVERY_PORTS must contain ports from 1 to 65535");
    return port;
  });
  const pairingSecret = required(env, "PRINT_GATEWAY_PAIRING_SECRET");
  if (Buffer.byteLength(pairingSecret) < 32) throw new Error("PRINT_GATEWAY_PAIRING_SECRET must be at least 32 bytes");
  const targetCount = discoveryCidrs.reduce((total, cidr) => total + cidr.size, 0) * new Set(discoveryPorts).size;
  if (targetCount > 4096) throw new Error("Discovery scope must contain at most 4096 address/port targets");
  return {
    bindHost, port: integer(env, "PRINT_GATEWAY_PORT", 17321, { max: 65535 }), publicUrl: publicUrl.origin,
    allowedOrigins, discoveryCidrs, discoveryPorts: [...new Set(discoveryPorts)],
    discoveryTimeoutMs: integer(env, "PRINT_GATEWAY_DISCOVERY_TIMEOUT_MS", 500, { max: 10_000 }),
    discoveryConcurrency: integer(env, "PRINT_GATEWAY_DISCOVERY_CONCURRENCY", 16, { max: 64 }),
    rescanTtlMs: integer(env, "PRINT_GATEWAY_RESCAN_TTL_MS", 30_000, { max: 300_000 }), pairingSecret,
    pairingCodeTtlSeconds: integer(env, "PRINT_GATEWAY_PAIRING_CODE_TTL_SECONDS", 300, { max: 3600 }),
    tokenTtlDays: integer(env, "PRINT_GATEWAY_TOKEN_TTL_DAYS", 90, { max: 365 }),
    maxPayloadBytes: integer(env, "PRINT_GATEWAY_MAX_PAYLOAD_BYTES", 2_000_000, { max: 10_000_000 }),
    tcpTimeoutMs: integer(env, "PRINT_GATEWAY_TCP_TIMEOUT_MS", 10_000, { max: 60_000 }),
    statePath: required(env, "PRINT_GATEWAY_STATE_PATH"), tlsCertPath, tlsKeyPath,
    debugBytes: (env.NODE_ENV ?? process.env.NODE_ENV) !== "production"
      && env.PRINT_GATEWAY_DEBUG_BYTES === "true",
  };
}

export async function assertEnvironmentFilePermissions(path, { platform = process.platform, getuid = process.getuid } = {}) {
  if (!path || platform === "win32" || typeof getuid !== "function" || getuid() === 0) return;
  const stats = await stat(path);
  if ((stats.mode & 0o077) !== 0) throw new Error(`Gateway environment file "${path}" must be owner-only: chmod 600`);
}

export async function loadConfig(env = process.env) {
  await assertEnvironmentFilePermissions(env.PRINT_GATEWAY_ENV_FILE);
  return validateEnvironment(env);
}

export { ENV_KEYS };
