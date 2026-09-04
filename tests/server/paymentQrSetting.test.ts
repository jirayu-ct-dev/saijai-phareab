import { describe, expect, it } from "vitest";
import {
  PaymentQrSettingError,
  prepareMobilePaymentQrUpdate,
  projectPaymentQrSetting,
} from "../../server/utils/paymentQrSetting";
import { decryptPaymentQrReceiverValue } from "../../server/utils/printDocument";

const key = Buffer.alloc(32, 7);
const keyring = { "1": key };
const now = new Date("2026-09-04T15:00:00.000Z");

describe("payment QR admin setting", () => {
  it("encrypts a validated shop mobile number and exposes only its last four digits", () => {
    const update = prepareMobilePaymentQrUpdate({
      current: null,
      input: { enabled: true, receiverValue: "081-234-5678", receiverLabel: "ร้านใส่ใจ ผ้าเรียบ" },
      keyring,
      actorId: "admin-1",
      now,
    });

    expect(update).toMatchObject({
      paymentQrEnabled: true,
      paymentQrProvider: "PROMPTPAY_LOCAL",
      paymentQrReceiverType: "MOBILE",
      paymentQrReceiverLast4: "5678",
      paymentQrReceiverLabel: "ร้านใส่ใจ ผ้าเรียบ",
      paymentQrKeyVersion: 1,
      paymentQrConfigVersion: 1,
      paymentQrActivatedAt: now,
      paymentQrActivatedById: "admin-1",
      paymentQrUpdatedById: "admin-1",
    });
    expect(update.paymentQrReceiverCiphertext).not.toContain("0812345678");
    expect(decryptPaymentQrReceiverValue({
      ciphertext: update.paymentQrReceiverCiphertext!,
      keyVersion: update.paymentQrKeyVersion!,
      keyring,
    })).toEqual({ ok: true, value: "0812345678" });

    const projected = projectPaymentQrSetting(update);
    expect(projected).toEqual({
      enabled: true,
      configured: true,
      receiverType: "MOBILE",
      receiverLast4: "5678",
      receiverLabel: "ร้านใส่ใจ ผ้าเรียบ",
      activatedAt: now.toISOString(),
      configVersion: 1,
    });
    expect(JSON.stringify(projected)).not.toContain("0812345678");
    expect(JSON.stringify(projected)).not.toContain("Ciphertext");
  });

  it("preserves the encrypted receiver when toggling without submitting a new number", () => {
    const current = prepareMobilePaymentQrUpdate({
      current: null,
      input: { enabled: true, receiverValue: "0812345678", receiverLabel: "ร้าน" },
      keyring,
      actorId: "admin-1",
      now,
    });
    const update = prepareMobilePaymentQrUpdate({
      current,
      input: { enabled: false, receiverValue: null, receiverLabel: "ร้านใหม่" },
      keyring,
      actorId: "admin-2",
      now: new Date("2026-09-05T00:00:00.000Z"),
    });

    expect(update.paymentQrReceiverCiphertext).toBe(current.paymentQrReceiverCiphertext);
    expect(update.paymentQrActivatedAt).toBe(current.paymentQrActivatedAt);
    expect(update.paymentQrEnabled).toBe(false);
    expect(update.paymentQrConfigVersion).toBe(2);
  });

  it("fails closed when enabling without a receiver or encryption key", () => {
    expect(() => prepareMobilePaymentQrUpdate({
      current: null,
      input: { enabled: true, receiverValue: null, receiverLabel: "ร้าน" },
      keyring,
      actorId: "admin-1",
      now,
    })).toThrow(PaymentQrSettingError);

    expect(() => prepareMobilePaymentQrUpdate({
      current: null,
      input: { enabled: true, receiverValue: "0812345678", receiverLabel: "ร้าน" },
      keyring: {},
      actorId: "admin-1",
      now,
    })).toThrow("ยังไม่ได้ตั้งค่ากุญแจเข้ารหัส PromptPay");

    const current = prepareMobilePaymentQrUpdate({
      current: null,
      input: { enabled: true, receiverValue: "0812345678", receiverLabel: "ร้าน" },
      keyring,
      actorId: "admin-1",
      now,
    });
    expect(() => prepareMobilePaymentQrUpdate({
      current,
      input: { enabled: true, receiverValue: null, receiverLabel: "ร้าน" },
      keyring: {},
      actorId: "admin-1",
      now,
    })).toThrow("กุญแจเข้ารหัส PromptPay ไม่ตรง");
  });
});
