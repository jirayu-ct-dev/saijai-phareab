export type VatBreakdown = {
  baseAmount: number;
  vatAmount: number;
  totalAmount: number;
  vatRate: number;
  vatIncluded: boolean;
};

export const computeVat = (params: {
  amount: number;
  rate: number;
  included: boolean;
}): VatBreakdown => {
  const amount = Number(params.amount) || 0;
  const rate = Number(params.rate) || 0;
  const included = Boolean(params.included);

  if (rate <= 0 || amount <= 0) {
    return {
      baseAmount: amount,
      vatAmount: 0,
      totalAmount: amount,
      vatRate: rate,
      vatIncluded: included,
    };
  }

  if (included) {
    const totalAmount = amount;
    const baseAmount = totalAmount / (1 + rate / 100);
    const vatAmount = totalAmount - baseAmount;
    return {
      baseAmount: round2(baseAmount),
      vatAmount: round2(vatAmount),
      totalAmount: round2(totalAmount),
      vatRate: rate,
      vatIncluded: true,
    };
  }

  const baseAmount = amount;
  const vatAmount = baseAmount * (rate / 100);
  const totalAmount = baseAmount + vatAmount;
  return {
    baseAmount: round2(baseAmount),
    vatAmount: round2(vatAmount),
    totalAmount: round2(totalAmount),
    vatRate: rate,
    vatIncluded: false,
  };
};

const round2 = (n: number): number => Math.round(n * 100) / 100;
