// ============================
// Thai QR (PromptPay) validator (pure)
// ============================
//
// Cross-checks a generated (or any claimed) payload against the receiver
// configuration and exact amount the server intended to encode, before the
// payload may enter a document snapshot or be printed. Independent of the
// encoder: CRC is recomputed from the raw payload and semantics are checked
// against the parser output.

import type { PaymentQrReceiverType } from "../../../shared/types/printing";
import { decimalStringToMinor } from "./amount";
import { crc16CcittFalse, PROMPTPAY_AID, THB_CURRENCY_CODE } from "./emvco";
import {
  extractPromptPayReceiver,
  parsePromptPayPayload,
  PromptPayParseError,
} from "./parser";
import { normalizePromptPayReceiver } from "./encoder";

export type PromptPayValidationError =
  | "MALFORMED_PAYLOAD"
  | "CRC_INVALID"
  | "PAYLOAD_FORMAT_MISMATCH"
  | "AID_MISMATCH"
  | "RECEIVER_MISSING"
  | "RECEIVER_MISMATCH"
  | "CURRENCY_MISMATCH"
  | "AMOUNT_MISSING"
  | "AMOUNT_MISMATCH";

export type PromptPayValidationResult = {
  valid: boolean;
  errors: PromptPayValidationError[];
};

export type ValidatePromptPayPayloadInput = {
  payload: string;
  expectedReceiverType: PaymentQrReceiverType;
  /** Raw receiver value; normalized before comparison. */
  expectedReceiverValue: string;
  /** Exact minor units expected in tag 54, or null when no amount is expected. */
  expectedAmountMinor: number | null;
  /** When true (default), tag 29's AID must be the PromptPay AID. */
  requirePromptPayAid?: boolean;
};

/** Recomputes the CRC-16/CCITT-FALSE over the payload and compares tag 63. */
export function verifyPayloadCrc(payload: string): boolean {
  if (typeof payload !== "string" || payload.length < 8) return false;
  const withoutCrc = payload.slice(0, -4);
  const crc = payload.slice(-4);
  return crc === crc16CcittFalse(withoutCrc);
}

/**
 * Validates structure, CRC, currency, receiver and amount. A payload is valid
 * only when every expected aspect matches exactly; any mismatch is reported
 * as a distinct error code (never silently ignored).
 */
export function validatePromptPayPayload(
  input: ValidatePromptPayPayloadInput,
): PromptPayValidationResult {
  const {
    payload,
    expectedReceiverType,
    expectedReceiverValue,
    expectedAmountMinor,
    requirePromptPayAid = true,
  } = input;

  const errors: PromptPayValidationError[] = [];
  let parsed;
  try {
    parsed = parsePromptPayPayload(payload);
  } catch (error) {
    if (error instanceof PromptPayParseError) {
      return { valid: false, errors: ["MALFORMED_PAYLOAD"] };
    }
    throw error;
  }

  if (!verifyPayloadCrc(payload)) {
    errors.push("CRC_INVALID");
  }
  if (parsed.payloadFormatIndicator !== "01") {
    errors.push("PAYLOAD_FORMAT_MISMATCH");
  }
  if (parsed.merchantAccount === null) {
    errors.push("RECEIVER_MISSING");
  } else {
    if (requirePromptPayAid && parsed.merchantAccount.aid !== PROMPTPAY_AID) {
      errors.push("AID_MISMATCH");
    }
    const receiver = extractPromptPayReceiver(parsed.merchantAccount);
    if (receiver === null) {
      errors.push("RECEIVER_MISSING");
    } else {
      const expectedNormalized = normalizePromptPayReceiver(
        expectedReceiverType,
        expectedReceiverValue,
      );
      if (
        receiver.receiverType !== expectedReceiverType ||
        receiver.receiverValue !== expectedNormalized
      ) {
        errors.push("RECEIVER_MISMATCH");
      }
    }
  }
  if (parsed.currency !== THB_CURRENCY_CODE) {
    errors.push("CURRENCY_MISMATCH");
  }
  if (expectedAmountMinor === null) {
    if (parsed.amount !== null) {
      errors.push("AMOUNT_MISMATCH");
    }
  } else if (parsed.amount === null) {
    errors.push("AMOUNT_MISSING");
  } else {
    let parsedAmountMinor: number;
    try {
      parsedAmountMinor = decimalStringToMinor(parsed.amount);
    } catch {
      parsedAmountMinor = Number.NaN;
    }
    if (!Number.isSafeInteger(parsedAmountMinor) || parsedAmountMinor !== expectedAmountMinor) {
      errors.push("AMOUNT_MISMATCH");
    }
  }
  return { valid: errors.length === 0, errors };
}
