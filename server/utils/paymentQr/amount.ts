// ============================
// Exact money boundary (pure)
// ============================
//
// C10: never create a QR payload or compare amounts through JavaScript
// floating-point arithmetic. Decimal strings from the database boundary are
// converted to exact integer minor units (satang) with pure string/integer
// math only.

const DECIMAL_STRING_PATTERN = /^(0|[1-9][0-9]*)(\.[0-9]{1,2})?$/;

export class InvalidAmountError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidAmountError";
  }
}

/**
 * Converts a non-negative decimal string (e.g. "1234.56") to exact integer
 * minor units without any floating-point arithmetic.
 *
 * Accepts: "0.01", "1", "1234.56", "1234.5" (one decimal is padded).
 * Rejects: zero, negative values, signs, thousands separators, exponents,
 * more than two decimal places, empty/whitespace input and any value whose
 * minor units exceed Number.MAX_SAFE_INTEGER.
 */
export function decimalStringToMinor(value: string): number {
  if (typeof value !== "string" || !DECIMAL_STRING_PATTERN.test(value)) {
    throw new InvalidAmountError(
      `Amount must be a non-negative decimal string with at most 2 decimal places, got ${JSON.stringify(value)}`,
    );
  }
  const parts = value.split(".");
  const wholePart = parts[0] ?? "0";
  const decimalPart = parts[1] ?? "";
  // Zero (with any number of leading zeros in the whole part, e.g. "0.00",
  // "0.0") is invalid for payment QR: nothing to collect.
  if (BigInt(wholePart) === 0n && (decimalPart === "" || /^0+$/.test(decimalPart))) {
    throw new InvalidAmountError("Amount must be greater than zero");
  }
  const padded = decimalPart.padEnd(2, "0");
  const minorDigits = `${wholePart}${padded}`.replace(/^0+(?=\d)/, "");
  const minor = BigInt(minorDigits);
  if (minor > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new InvalidAmountError("Amount exceeds the safe integer range for minor units");
  }
  return Number(minor);
}

/**
 * Formats exact integer minor units as a fixed two-decimal decimal string
 * (e.g. 1 -> "0.01", 123400 -> "1234.00") using string manipulation only.
 */
export function minorToDecimalString(minor: number): string {
  if (!Number.isSafeInteger(minor) || minor < 0) {
    throw new InvalidAmountError("Minor units must be a non-negative safe integer");
  }
  const digits = String(minor).padStart(3, "0");
  return `${digits.slice(0, -2)}.${digits.slice(-2)}`;
}
