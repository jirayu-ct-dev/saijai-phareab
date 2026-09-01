// ============================
// EMVCo MPM primitives (pure)
// ============================
//
// Hand-rolled Tag-Length-Value (TLV) encoding/parsing and CRC-16/CCITT-FALSE
// for Thai QR Payment (PromptPay) payloads. No external packages.
//
// References: Thai QR Payment Standard (Bank of Thailand), EMVCo Merchant
// Presented Mode specification. Payloads here are ASCII-only, so the CRC is
// computed over the raw string characters (1 byte each).

export const PROMPTPAY_AID = "A000000677010111";
export const THB_CURRENCY_CODE = "764";
export const THAILAND_COUNTRY_CODE = "TH";
export const PAYLOAD_FORMAT_INDICATOR = "01";
export const POINT_OF_INITIATION_STATIC = "11";
export const POINT_OF_INITIATION_DYNAMIC = "12";

export const MERCHANT_ACCOUNT_TAG_PROMPTPAY = "29";
export const MERCHANT_ACCOUNT_TAG_BILL_PAYMENT = "30";

/** CRC-16/CCITT-FALSE (poly 0x1021, init 0xFFFF, no reflection, xorout 0). */
export function crc16CcittFalse(input: string): string {
  let crc = 0xffff;
  for (let i = 0; i < input.length; i++) {
    const code = input.charCodeAt(i);
    if (code > 0x7f) {
      throw new Error("CRC input must be ASCII");
    }
    crc ^= code << 8;
    for (let bit = 0; bit < 8; bit++) {
      crc = (crc & 0x8000) !== 0 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

const isAscii = (value: string): boolean =>
  [...value].every((ch) => ch.charCodeAt(0) <= 0x7f);

/** Builds one `tag + 2-digit length + value` element. */
export function buildTlv(tag: string, value: string): string {
  if (!/^[0-9]{2}$/.test(tag)) {
    throw new Error(`Invalid TLV tag: ${JSON.stringify(tag)}`);
  }
  if (typeof value !== "string" || !isAscii(value)) {
    throw new Error(`TLV value for tag ${tag} must be an ASCII string`);
  }
  if (value.length > 99) {
    throw new Error(`TLV value for tag ${tag} exceeds 99 characters`);
  }
  return `${tag}${value.length.toString(10).padStart(2, "0")}${value}`;
}

export type TlvElement = { tag: string; value: string };

/**
 * Parses a TLV string into ordered elements. Any structural defect (odd
 * length, non-numeric tag/length, length overrun/underrun, non-ASCII) throws.
 */
export function parseTlv(input: string): TlvElement[] {
  if (typeof input !== "string" || !isAscii(input)) {
    throw new Error("Malformed TLV payload");
  }
  const elements: TlvElement[] = [];
  let offset = 0;
  while (offset < input.length) {
    if (offset + 4 > input.length) {
      throw new Error(`Truncated TLV element at offset ${offset}`);
    }
    const tag = input.slice(offset, offset + 2);
    const lengthText = input.slice(offset + 2, offset + 4);
    if (!/^[0-9]{2}$/.test(tag) || !/^[0-9]{2}$/.test(lengthText)) {
      throw new Error(`Malformed TLV element at offset ${offset}`);
    }
    const length = Number.parseInt(lengthText, 10);
    const valueStart = offset + 4;
    const valueEnd = valueStart + length;
    if (valueEnd > input.length) {
      throw new Error(`TLV length overrun at offset ${offset}`);
    }
    const value = input.slice(valueStart, valueEnd);
    if (!isAscii(value)) {
      throw new Error(`Non-ASCII TLV value at offset ${offset}`);
    }
    elements.push({ tag, value });
    offset = valueEnd;
  }
  return elements;
}
