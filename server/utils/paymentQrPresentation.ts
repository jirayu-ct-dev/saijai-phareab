import QRCode from "qrcode";
import type { ReceiptPayload } from "~~/shared/types/receipt";
import { loadCurrentDirectPrintDocument } from "~~/server/utils/directPrintDocument";

export type PaymentQrPresentation = NonNullable<ReceiptPayload["paymentQr"]>;

/**
 * Builds the web/PDF QR from the same validated payment block used by direct
 * ESC/POS printing. Receiver plaintext and encryption material never enter
 * the returned presentation contract.
 */
export const loadPaymentQrPresentation = async (input: {
  paymentId: string;
  userId?: string;
}): Promise<PaymentQrPresentation | null> => {
  let document: Awaited<ReturnType<typeof loadCurrentDirectPrintDocument>>;
  try {
    document = await loadCurrentDirectPrintDocument({
      paymentId: input.paymentId,
      kind: "QUOTATION",
      userId: input.userId,
    });
  } catch (error) {
    // Package-only payments have no quotation. Preserve the existing page
    // payload and simply omit a payment QR for that document shape.
    if (error && typeof error === "object" && "statusCode" in error && error.statusCode === 409) {
      return null;
    }
    throw error;
  }
  const block = document.qrBlocks.find((candidate) => candidate.kind === "PAYMENT");
  if (!block || block.kind !== "PAYMENT") return null;

  let imageDataUrl: string;
  try {
    imageDataUrl = await QRCode.toDataURL(block.payload, {
      errorCorrectionLevel: "M",
      margin: 2,
      width: 280,
    });
  } catch {
    return null;
  }
  return {
    imageDataUrl,
    caption: block.caption,
    amountMinor: block.amountMinor,
    currency: block.currency,
    receiverLabel: block.receiverLabel,
  };
};
