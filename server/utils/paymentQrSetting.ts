import { buildPromptPayPayload } from "~~/server/utils/paymentQr/encoder";
import { validatePromptPayPayload } from "~~/server/utils/paymentQr/validator";
import {
  decryptPaymentQrReceiverValue,
  encryptPaymentQrReceiverValue,
} from "~~/server/utils/printDocument";

export type PaymentQrSettingRecord = {
  paymentQrEnabled?: boolean | null;
  paymentQrProvider?: string | null;
  paymentQrReceiverType?: string | null;
  paymentQrReceiverCiphertext?: string | null;
  paymentQrReceiverLast4?: string | null;
  paymentQrReceiverLabel?: string | null;
  paymentQrKeyVersion?: number | null;
  paymentQrConfigVersion?: number | null;
  paymentQrActivatedAt?: Date | string | null;
  paymentQrActivatedById?: string | null;
};

export type AdminPaymentQrSetting = {
  enabled: boolean;
  configured: boolean;
  receiverType: "MOBILE";
  receiverLast4: string | null;
  receiverLabel: string | null;
  activatedAt: string | null;
  configVersion: number;
};

export class PaymentQrSettingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PaymentQrSettingError";
  }
}

const canonicalDomesticMobile = (value: string): string => {
  const digits = value.replace(/[\s-]/g, "");
  const match = /^(?:\+66|66|0)([1-9][0-9]{8})$/.exec(digits);
  if (!match) {
    throw new PaymentQrSettingError("กรุณากรอกหมายเลขโทรศัพท์ PromptPay ให้ถูกต้อง");
  }
  return `0${match[1]}`;
};

const activeKey = (keyring: Record<string, Buffer>): { version: number; key: Buffer } => {
  const versions = Object.keys(keyring)
    .filter((value) => /^[1-9][0-9]*$/.test(value))
    .map(Number)
    .filter(Number.isSafeInteger)
    .sort((a, b) => b - a);
  const version = versions[0];
  const key = version === undefined ? undefined : keyring[String(version)];
  if (version === undefined || !key || key.length !== 32) {
    throw new PaymentQrSettingError("ยังไม่ได้ตั้งค่ากุญแจเข้ารหัส PromptPay บนเซิร์ฟเวอร์");
  }
  return { version, key };
};

export const projectPaymentQrSetting = (
  row: PaymentQrSettingRecord | null,
): AdminPaymentQrSetting => ({
  enabled: row?.paymentQrEnabled === true,
  configured: Boolean(
    row?.paymentQrReceiverCiphertext
    && row.paymentQrKeyVersion
    && row.paymentQrActivatedAt,
  ),
  receiverType: "MOBILE",
  receiverLast4: row?.paymentQrReceiverLast4 ?? null,
  receiverLabel: row?.paymentQrReceiverLabel ?? null,
  activatedAt: row?.paymentQrActivatedAt
    ? typeof row.paymentQrActivatedAt === "string"
      ? row.paymentQrActivatedAt
      : row.paymentQrActivatedAt.toISOString()
    : null,
  configVersion: row?.paymentQrConfigVersion ?? 0,
});

export const prepareMobilePaymentQrUpdate = (input: {
  current: PaymentQrSettingRecord | null;
  input: { enabled: boolean; receiverValue: string | null; receiverLabel: string };
  keyring: Record<string, Buffer>;
  actorId: string;
  now: Date;
}) => {
  const receiverLabel = input.input.receiverLabel.trim();
  if (!receiverLabel) throw new PaymentQrSettingError("กรุณากรอกชื่อผู้รับเงิน");

  let ciphertext = input.current?.paymentQrReceiverCiphertext ?? null;
  let last4 = input.current?.paymentQrReceiverLast4 ?? null;
  let keyVersion = input.current?.paymentQrKeyVersion ?? null;
  let activatedAt = input.current?.paymentQrActivatedAt ?? null;
  let activatedById = input.current?.paymentQrActivatedById ?? null;

  if (input.input.receiverValue) {
    const receiverValue = canonicalDomesticMobile(input.input.receiverValue);
    const payload = buildPromptPayPayload({
      receiverType: "MOBILE",
      receiverValue,
      amountMinor: 1,
    });
    const validation = validatePromptPayPayload({
      payload,
      expectedReceiverType: "MOBILE",
      expectedReceiverValue: receiverValue,
      expectedAmountMinor: 1,
    });
    if (!validation.valid) {
      throw new PaymentQrSettingError("ไม่สามารถตรวจสอบข้อมูล PromptPay ได้");
    }
    const selectedKey = activeKey(input.keyring);
    ciphertext = encryptPaymentQrReceiverValue({
      value: receiverValue,
      keyVersion: selectedKey.version,
      key: selectedKey.key,
    });
    last4 = receiverValue.slice(-4);
    keyVersion = selectedKey.version;
    activatedAt = input.now;
    activatedById = input.actorId;
  }

  if (input.input.enabled && (!ciphertext || !keyVersion || !activatedAt)) {
    throw new PaymentQrSettingError("กรุณากำหนดหมายเลขโทรศัพท์ PromptPay ก่อนเปิดใช้งาน");
  }
  if (input.input.enabled && ciphertext && keyVersion && !input.input.receiverValue) {
    const resolved = decryptPaymentQrReceiverValue({ ciphertext, keyVersion, keyring: input.keyring });
    if (!resolved.ok) {
      throw new PaymentQrSettingError("กุญแจเข้ารหัส PromptPay ไม่ตรงกับข้อมูลที่บันทึกไว้");
    }
  }

  return {
    paymentQrEnabled: input.input.enabled,
    paymentQrProvider: "PROMPTPAY_LOCAL" as const,
    paymentQrReceiverType: "MOBILE" as const,
    paymentQrReceiverCiphertext: ciphertext,
    paymentQrReceiverLast4: last4,
    paymentQrReceiverLabel: receiverLabel,
    paymentQrKeyVersion: keyVersion,
    paymentQrConfigVersion: (input.current?.paymentQrConfigVersion ?? 0) + 1,
    paymentQrActivatedAt: activatedAt,
    paymentQrActivatedById: activatedById,
    paymentQrUpdatedById: input.actorId,
  };
};
