export type PaymentVat = {
  rate: number;
  amount: number;
  included: boolean;
  baseAmount: number;
};

/**
 * Extracts the customer-facing VAT summary from payment metadata. The raw
 * metadata object also carries internal staff/system fields and must never
 * be returned to customers as-is.
 */
export function extractPaymentVat(metadata: unknown): PaymentVat | null {
  const meta = (metadata ?? null) as { vat?: { rate?: number; amount?: number; included?: boolean; baseAmount?: number } } | null;
  const vat = meta?.vat;
  if (!vat || !Number.isFinite(Number(vat.rate)) || Number(vat.rate) <= 0) return null;
  return {
    rate: Number(vat.rate),
    amount: Number(vat.amount ?? 0),
    included: Boolean(vat.included),
    baseAmount: Number(vat.baseAmount ?? 0),
  };
}
