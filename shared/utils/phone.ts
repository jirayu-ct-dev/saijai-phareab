const THAI_DIGITS = "๐๑๒๓๔๕๖๗๘๙";
// Keep this list in sync with the backfill expression in
// 20260818000000_add_reusable_customer_accounts. NBSP is included because it
// commonly appears when a formatted phone number is copied from another app.
const PHONE_FORMATTING_CHARS = /[ \t\n\r\f\v\u00a0\-()]/g;

const toAsciiDigits = (value: string): string =>
  value.replace(/[๐-๙]/g, (digit) => String(THAI_DIGITS.indexOf(digit)));

/**
 * Normalizes a Thai phone number for lookup and uniqueness checks.
 *
 * The display value should remain in `phoneNumber`; this function returns the
 * canonical domestic form used by `normalizedPhoneNumber`.
 */
export function normalizeThaiPhoneNumber(value: string): string | null {
  const compact = toAsciiDigits(value).replace(PHONE_FORMATTING_CHARS, "");
  if (!compact) return null;

  const domestic = compact.startsWith("+66")
    ? `0${compact.slice(3)}`
    : compact;

  return /^0\d{8,9}$/.test(domestic) ? domestic : null;
}
