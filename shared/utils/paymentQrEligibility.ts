import type { PaymentStatus } from "../types/enums";
import type { PaymentQrSettingSnapshot, PrintDocumentKind } from "../types/printing";

export type PaymentQrIneligibilityReason =
  | "QR_DISABLED"
  | "DOCUMENT_NOT_QUOTATION"
  | "PAYMENT_NOT_UNPAID"
  | "AMOUNT_NOT_POSITIVE"
  | "RECEIVER_NOT_ACTIVATED";

export type PaymentQrEligibilityResult = {
  eligible: boolean;
  reasons: PaymentQrIneligibilityReason[];
};

export const evaluatePaymentQrEligibility = (input: {
  documentKind: PrintDocumentKind;
  paymentStatus: PaymentStatus;
  amountMinor: number;
  paymentQrEnabled: boolean;
  receiverActivated: boolean;
}): PaymentQrEligibilityResult => {
  const reasons: PaymentQrIneligibilityReason[] = [];
  if (!input.paymentQrEnabled) reasons.push("QR_DISABLED");
  if (input.documentKind !== "QUOTATION") reasons.push("DOCUMENT_NOT_QUOTATION");
  if (input.paymentStatus !== "UNPAID") reasons.push("PAYMENT_NOT_UNPAID");
  if (!Number.isSafeInteger(input.amountMinor) || input.amountMinor <= 0) reasons.push("AMOUNT_NOT_POSITIVE");
  if (!input.receiverActivated) reasons.push("RECEIVER_NOT_ACTIVATED");
  return { eligible: reasons.length === 0, reasons };
};

export const isPaymentQrReceiverActivated = (
  setting: Pick<
    PaymentQrSettingSnapshot,
    "paymentQrEnabled" | "paymentQrReceiverCiphertext" | "paymentQrKeyVersion" | "paymentQrActivatedAt"
  >,
): boolean => Boolean(
  setting.paymentQrEnabled
  && setting.paymentQrReceiverCiphertext
  && setting.paymentQrKeyVersion
  && setting.paymentQrActivatedAt,
);
