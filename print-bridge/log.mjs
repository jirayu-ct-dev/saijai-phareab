/**
 * Structured stderr logger with credential redaction.
 *
 * The bridge credential (bearer token) must never appear in logs. Every log
 * line is stringified first, then any occurrence of the credential is replaced
 * with "[REDACTED]" before it reaches the sink. The credential is therefore
 * safe even when it accidentally ends up inside an error message or detail.
 */

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };

export function createRedactingLogger({
  credential,
  write = (line) => process.stderr.write(line),
  level = "info",
  now = () => new Date().toISOString(),
}) {
  const threshold = LEVELS[level] ?? LEVELS.info;

  function redact(value) {
    const text = typeof value === "string" ? value : JSON.stringify(value);
    if (!credential) return text;
    return text.split(credential).join("[REDACTED]");
  }

  function emit(logLevel, msg, detail) {
    if ((LEVELS[logLevel] ?? threshold) < threshold) return;
    // Build the line, then redact the whole serialized line so no field can
    // leak the credential.
    let line = JSON.stringify({ ts: now(), level: logLevel, msg: String(msg) });
    if (detail !== undefined) {
      line = line.slice(0, -1) + `,"detail":${JSON.stringify(String(detail))}}`;
    }
    write(redact(line) + "\n");
  }

  return {
    debug: (msg, detail) => emit("debug", msg, detail),
    info: (msg, detail) => emit("info", msg, detail),
    warn: (msg, detail) => emit("warn", msg, detail),
    error: (msg, detail) => emit("error", msg, detail),
  };
}
