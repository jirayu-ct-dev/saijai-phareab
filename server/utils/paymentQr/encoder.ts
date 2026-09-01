// ============================
// Thai QR (PromptPay) encoder (pure)
// ============================
//
// Builds an EMVCo Merchant-Presented Thai QR payload from a receiver
// configuration and an exact integer amount in minor units. The amount always
// comes from the canonical server document (PaymentRecord / print document),
// never from the browser.

import type { PaymentQrReceiverType } from "../../../shared/types/printing";
import { InvalidAmountError, minorToDecimalString } from "./amount";
import {
  buildTlv,
  crc16CcittFalse,
  MERCHANT_ACCOUNT_TAG_BILL_PAYMENT,
  MERCHANT_ACCOUNT_TAG_PROMPTPAY,
  PAYLOAD_FORMAT_INDICATOR,
  POINT_OF_INITIATION_DYNAMIC,
  POINT_OF_INITIATION_STATIC,
  PROMPTPAY_AID,
  THAILAND_COUNTRY_CODE,
  THB_CURRENCY_CODE,
} from "./emvco";

export type PromptPayReceiver = {
  receiverType: PaymentQrReceiverType;
  /** Raw receiver value; normalized per type before encoding. */
  receiverValue: string;
};

export type BuildPromptPayPayloadInput = PromptPayReceiver & {
  /** Exact minor units; must be a positive safe integer, or null for a static (reusable) QR. */
  amountMinor: number | null;
  /** "29" (PromptPay, default) or "30" (bill payment). */
  merchantAccountTag?: "29" | "30";
  merchantName?: string;
  merchantCity?: string;
};

export class PromptPayEncodeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PromptPayEncodeError";
  }
}

const MOBILE_PATTERN = /^(?:\+66|66|0)([1-9][0-9]{8})$/;
const NATIONAL_ID_PATTERN = /^[0-9]{13}$/;
const EWALLET_PATTERN = /^[0-9]{15}$/;

/**
 * Normalizes a receiver per Thai QR standard:
 * - MOBILE: domestic "0XXXXXXXXX" (or +66/66 form) -> "0066XXXXXXXXX" (13 chars)
 * - NATIONAL_OR_TAX_ID: 13 digits, digits only
 * - EWALLET: 15 digits, digits only
 */
export function normalizePromptPayReceiver(
  receiverType: PaymentQrReceiverType,
  receiverValue: string,
): string {
  if (typeof receiverValue !== "string") {
    throw new PromptPayEncodeError("Receiver value must be a string");
  }
  if (receiverType === "MOBILE") {
    const match = MOBILE_PATTERN.exec(receiverValue);
    if (!match) {
      throw new PromptPayEncodeError(
        "MOBILE receiver must be a 10-digit domestic number (0XXXXXXXXX) or +66XXXXXXXXX",
      );
    }
    return `0066${match[1]}`;
  }
  const digitsOnly = receiverValue.replace(/[\s-]/g, "");
  if (receiverType === "NATIONAL_OR_TAX_ID") {
    if (!NATIONAL_ID_PATTERN.test(digitsOnly)) {
      throw new PromptPayEncodeError("NATIONAL_OR_TAX_ID receiver must be exactly 13 digits");
    }
    return digitsOnly;
  }
  if (!EWALLET_PATTERN.test(digitsOnly)) {
    throw new PromptPayEncodeError("EWALLET receiver must be exactly 15 digits");
  }
  return digitsOnly;
}

/**
 * Encodes a Thai QR / PromptPay Merchant-Presented payload:
 *   00 payload format "01"
 *   01 point of initiation "11" (static, no amount) or "12" (dynamic, with amount)
 *   29/30 merchant account info (AID A000000677010111 + receiver sub-tag 01/02/03)
 *   53 currency 764 (THB)
 *   54 amount with exactly two decimals (string math, no float)
 *   58 country "TH"
 *   59/60 optional merchant name/city (ASCII only)
 *   63 CRC-16/CCITT-FALSE
 */
export function buildPromptPayPayload(input: BuildPromptPayPayloadInput): string {
  const {
    receiverType,
    receiverValue,
    amountMinor,
    merchantAccountTag = MERCHANT_ACCOUNT_TAG_PROMPTPAY,
    merchantName,
    merchantCity,
  } = input;

  if (merchantAccountTag !== MERCHANT_ACCOUNT_TAG_PROMPTPAY && merchantAccountTag !== MERCHANT_ACCOUNT_TAG_BILL_PAYMENT) {
    throw new PromptPayEncodeError("merchantAccountTag must be 29 or 30");
  }

  const normalizedReceiver = normalizePromptPayReceiver(receiverType, receiverValue);
  const receiverSubTag =
    receiverType === "MOBILE" ? "01" : receiverType === "NATIONAL_OR_TAX_ID" ? "02" : "03";

  const merchantAccount =
    buildTlv("00", PROMPTPAY_AID) + buildTlv(receiverSubTag, normalizedReceiver);

  const hasAmount = amountMinor !== null;
  if (hasAmount) {
    if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) {
      throw new InvalidAmountError("amountMinor must be a positive safe integer or null");
    }
  }

  const elements: string[] = [
    buildTlv("00", PAYLOAD_FORMAT_INDICATOR),
    buildTlv("01", hasAmount ? POINT_OF_INITIATION_DYNAMIC : POINT_OF_INITIATION_STATIC),
    buildTlv(merchantAccountTag, merchantAccount),
    buildTlv("53", THB_CURRENCY_CODE),
  ];
  if (hasAmount) {
    // Exact two-decimal formatting via string math (C10).
    elements.push(buildTlv("54", minorToDecimalString(amountMinor)));
  }
  elements.push(buildTlv("58", THAILAND_COUNTRY_CODE));
  if (merchantName !== undefined) {
    elements.push(buildTlv("59", merchantName));
  }
  if (merchantCity !== undefined) {
    elements.push(buildTlv("60", merchantCity));
  }

  const withoutCrc = elements.join("") + "6304";
  return withoutCrc + crc16CcittFalse(withoutCrc);
}
