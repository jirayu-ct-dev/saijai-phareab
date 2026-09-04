import { beforeEach, describe, expect, it, vi } from "vitest";

const loadDocument = vi.hoisted(() => vi.fn());
vi.mock("~~/server/utils/directPrintDocument", () => ({
  loadCurrentDirectPrintDocument: loadDocument,
}));

describe("quotation payment QR presentation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders the validated direct-print payment block without receiver secrets", async () => {
    loadDocument.mockResolvedValue({
      qrBlocks: [{
        kind: "PAYMENT",
        payload: "00020101021229370016A0000006770101110113006681234567853037645406105.005802TH6304ABCD",
        amountMinor: 10_500,
        currency: "THB",
        receiverLabel: "ร้านใส่ใจ ผ้าเรียบ",
        caption: "สแกนชำระเงิน ฿105.00 บาท (รับโดย ร้านใส่ใจ ผ้าเรียบ)",
      }],
    });
    const { loadPaymentQrPresentation } = await import("../../server/utils/paymentQrPresentation");

    const result = await loadPaymentQrPresentation({ paymentId: "payment-1", userId: "user-1" });

    expect(loadDocument).toHaveBeenCalledWith({
      paymentId: "payment-1",
      kind: "QUOTATION",
      userId: "user-1",
    });
    expect(result).toMatchObject({
      caption: "สแกนชำระเงิน ฿105.00 บาท (รับโดย ร้านใส่ใจ ผ้าเรียบ)",
      amountMinor: 10_500,
      currency: "THB",
      receiverLabel: "ร้านใส่ใจ ผ้าเรียบ",
    });
    expect(result?.imageDataUrl).toMatch(/^data:image\/png;base64,/);
    expect(JSON.stringify(result)).not.toContain("0812345678");
    expect(JSON.stringify(result)).not.toContain("ciphertext");
  });

  it("returns null when the canonical document has no eligible payment block", async () => {
    loadDocument.mockResolvedValue({ qrBlocks: [] });
    const { loadPaymentQrPresentation } = await import("../../server/utils/paymentQrPresentation");

    await expect(loadPaymentQrPresentation({ paymentId: "payment-1" })).resolves.toBeNull();
  });

  it("preserves quotation pages without a service-order quotation", async () => {
    loadDocument.mockRejectedValue({ statusCode: 409 });
    const { loadPaymentQrPresentation } = await import("../../server/utils/paymentQrPresentation");

    await expect(loadPaymentQrPresentation({ paymentId: "payment-1" })).resolves.toBeNull();
  });
});
