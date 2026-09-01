// ============================
// Thai QR (PromptPay) parser (pure, independent)
// ============================
//
// Parses any conforming EMVCo Merchant-Presented payload back into structured
// fields. Written independently from the encoder so encoder output is always
// round-trip verified rather than re-derived from encoder internals.

import type { PaymentQrReceiverType } from "../../../shared/types/printing";
import {
  MERCHANT_ACCOUNT_TAG_BILL_PAYMENT,
  MERCHANT_ACCOUNT_TAG_PROMPTPAY,
  parseTlv,
  type TlvElement,
} from "./emvco";

export type ParsedPromptPayMerchantAccount = {
  tag: "29" | "30";
  aid: string | null;
  mobile: string | null;
  nationalId: string | null;
  eWallet: string | null;
};

export type ParsedPromptPayPayload = {
  payloadFormatIndicator: string | null;
  pointOfInitiationMethod: string | null;
  merchantAccount: ParsedPromptPayMerchantAccount | null;
  currency: string | null;
  /** Raw tag 54 value (a two-decimal decimal string) or null. */
  amount: string | null;
  countryCode: string | null;
  merchantName: string | null;
  merchantCity: string | null;
  /** All top-level elements in payload order (including 63). */
  elements: TlvElement[];
};

export class PromptPayParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PromptPayParseError";
  }
}

const RECEIVER_FIELDS = [
  { subTag: "01", field: "mobile" },
  { subTag: "02", field: "nationalId" },
  { subTag: "03", field: "eWallet" },
] as const;

function parseMerchantAccount(tag: string, value: string): ParsedPromptPayMerchantAccount {
  let subElements: TlvElement[];
  try {
    subElements = parseTlv(value);
  } catch (error) {
    throw new PromptPayParseError(
      error instanceof Error ? error.message : "Malformed merchant account info",
    );
  }
  const account: ParsedPromptPayMerchantAccount = {
    tag: tag === MERCHANT_ACCOUNT_TAG_PROMPTPAY ? "29" : "30",
    aid: null,
    mobile: null,
    nationalId: null,
    eWallet: null,
  };
  for (const { tag: subTag, value: subValue } of subElements) {
    if (subTag === "00") {
      account.aid = subValue;
      continue;
    }
    const known = RECEIVER_FIELDS.find((entry) => entry.subTag === subTag);
    if (known) {
      if (account[known.field] !== null) {
        throw new PromptPayParseError(`Duplicate receiver sub-tag ${subTag}`);
      }
      account[known.field] = subValue;
    }
  }
  return account;
}

/** Parses any conforming payload; throws PromptPayParseError on malformed structure. */
export function parsePromptPayPayload(payload: string): ParsedPromptPayPayload {
  if (typeof payload !== "string" || payload.length === 0) {
    throw new PromptPayParseError("Payload must be a non-empty string");
  }
  let elements: TlvElement[];
  try {
    elements = parseTlv(payload);
  } catch (error) {
    throw new PromptPayParseError(
      error instanceof Error ? error.message : "Malformed payload",
    );
  }
  const parsed: ParsedPromptPayPayload = {
    payloadFormatIndicator: null,
    pointOfInitiationMethod: null,
    merchantAccount: null,
    currency: null,
    amount: null,
    countryCode: null,
    merchantName: null,
    merchantCity: null,
    elements,
  };
  const seen = new Set<string>();
  for (const { tag, value } of elements) {
    if (seen.has(tag)) {
      throw new PromptPayParseError(`Duplicate top-level tag ${tag}`);
    }
    seen.add(tag);
    switch (tag) {
      case "00":
        parsed.payloadFormatIndicator = value;
        break;
      case "01":
        parsed.pointOfInitiationMethod = value;
        break;
      case MERCHANT_ACCOUNT_TAG_PROMPTPAY:
      case MERCHANT_ACCOUNT_TAG_BILL_PAYMENT:
        if (parsed.merchantAccount !== null) {
          throw new PromptPayParseError("Duplicate merchant account info tag");
        }
        parsed.merchantAccount = parseMerchantAccount(tag, value);
        break;
      case "53":
        parsed.currency = value;
        break;
      case "54":
        parsed.amount = value;
        break;
      case "58":
        parsed.countryCode = value;
        break;
      case "59":
        parsed.merchantName = value;
        break;
      case "60":
        parsed.merchantCity = value;
        break;
      default:
        break;
    }
  }
  return parsed;
}

/** Returns the receiver type/value encoded in the merchant account info, if any. */
export function extractPromptPayReceiver(
  account: ParsedPromptPayMerchantAccount,
): { receiverType: PaymentQrReceiverType; receiverValue: string } | null {
  if (account.mobile !== null) return { receiverType: "MOBILE", receiverValue: account.mobile };
  if (account.nationalId !== null) {
    return { receiverType: "NATIONAL_OR_TAX_ID", receiverValue: account.nationalId };
  }
  if (account.eWallet !== null) return { receiverType: "EWALLET", receiverValue: account.eWallet };
  return null;
}
