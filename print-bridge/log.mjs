const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };

/** Logs only an allowlisted message and safe error code; never request data or target details. */
export function createSafeLogger({
  write = (line) => process.stderr.write(line),
  level = "info",
  now = () => new Date().toISOString(),
} = {}) {
  const threshold = LEVELS[level] ?? LEVELS.info;
  const emit = (logLevel, message, code) => {
    if ((LEVELS[logLevel] ?? threshold) < threshold) return;
    const record = { ts: now(), level: logLevel, message: String(message) };
    if (typeof code === "string" && /^[A-Z0-9_]+$/.test(code)) record.code = code;
    write(`${JSON.stringify(record)}\n`);
  };
  return {
    debug: (message, code) => emit("debug", message, code),
    info: (message, code) => emit("info", message, code),
    warn: (message, code) => emit("warn", message, code),
    error: (message, code) => emit("error", message, code),
  };
}
