/**
 * Local configuration loader for the print bridge (PRN-04).
 *
 * The config file lives on the local machine and contains the bridge
 * credential, so it must never be world/group readable (chmod 600 on posix)
 * and its contents must never be logged.
 */

import { readFile, stat } from "node:fs/promises";
import path from "node:path";

function requireNonEmptyString(value, field) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Print bridge config field "${field}" must be a non-empty string`);
  }
  return value;
}

export function validateConfig(raw) {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("Print bridge config must be a JSON object");
  }

  const baseUrl = requireNonEmptyString(raw.baseUrl, "baseUrl");
  let parsedBase;
  try {
    parsedBase = new URL(baseUrl);
  } catch {
    throw new Error('Print bridge config "baseUrl" must be an absolute http(s) URL');
  }
  if (parsedBase.protocol !== "http:" && parsedBase.protocol !== "https:") {
    throw new Error('Print bridge config "baseUrl" must use http or https');
  }

  const printerId = requireNonEmptyString(raw.printerId, "printerId");
  const bridgeCredential = requireNonEmptyString(raw.bridgeCredential, "bridgeCredential");
  const outboxPath = requireNonEmptyString(raw.outboxPath, "outboxPath");

  if (
    raw.pollIntervalMs !== undefined &&
    (!Number.isInteger(raw.pollIntervalMs) || raw.pollIntervalMs <= 0)
  ) {
    throw new Error('Print bridge config "pollIntervalMs" must be a positive integer');
  }

  const tcpTarget = raw.tcpTarget;
  if (tcpTarget === null || typeof tcpTarget !== "object" || Array.isArray(tcpTarget)) {
    throw new Error('Print bridge config "tcpTarget" must be an object {host, port}');
  }
  const tcpHost = requireNonEmptyString(tcpTarget.host, "tcpTarget.host");
  const tcpPort = tcpTarget.port;
  if (!Number.isInteger(tcpPort) || tcpPort < 1 || tcpPort > 65535) {
    throw new Error('Print bridge config "tcpTarget.port" must be an integer between 1 and 65535');
  }

  return {
    baseUrl: baseUrl.replace(/\/+$/, ""),
    printerId,
    bridgeCredential,
    pollIntervalMs: raw.pollIntervalMs ?? 15000,
    heartbeatIntervalMs: raw.heartbeatIntervalMs ?? 60000,
    tcpTimeoutMs: raw.tcpTimeoutMs ?? 10000,
    outboxPath,
    tcpTarget: { host: tcpHost, port: tcpPort },
  };
}

/**
 * Loads and validates the local config file.
 * @param {string} [explicitPath] path from --config; defaults to ./config.json
 */
export async function loadConfig(explicitPath) {
  const configPath = path.resolve(explicitPath ?? "config.json");

  let stats;
  try {
    stats = await stat(configPath);
  } catch {
    throw new Error(
      `Print bridge config file not found: ${configPath}. ` +
        "Copy print-bridge/config.example.json and edit it locally.",
    );
  }
  if (!stats.isFile()) {
    throw new Error(`Print bridge config path is not a file: ${configPath}`);
  }

  // Never start with a credential-readable-by-others config. Skipped on
  // Windows (no posix mode bits) and for root (mode bits are not enforced).
  if (
    process.platform !== "win32" &&
    typeof process.getuid === "function" &&
    process.getuid() !== 0 &&
    (stats.mode & 0o077) !== 0
  ) {
    throw new Error(
      `Print bridge config "${configPath}" is readable by group/others. ` +
        "It holds the bridge credential, so it must be owner-only: chmod 600",
    );
  }

  let raw;
  try {
    raw = JSON.parse(await readFile(configPath, "utf8"));
  } catch (err) {
    throw new Error(`Print bridge config "${configPath}" is not valid JSON`, { cause: err });
  }

  return validateConfig(raw);
}
