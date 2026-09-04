import type { PaymentMethod, PaymentStatus, Timestamps, SoftDeletable } from "./enums";
import type { User } from "./auth";
import type { Image } from "./image";

// ============================
// PAYMENT RECORD
// ============================

export interface PaymentRecord extends Timestamps, SoftDeletable {
  id: string;
  userId: string;
  packageSaleId: string | null;
  serviceOrderId: string | null;
  paymentNo: string | null;
  receiptNo: string | null;
  amount: number | string;
  status: PaymentStatus;
  method: PaymentMethod | null;
  slipImageId: string | null;
  note: string | null;
  paidAt: Date | null;
  confirmedAt: Date | null;
  confirmedById: string | null;
  metadata: unknown | null;

  user?: User;
  slipImage?: Image | null;
  confirmedBy?: User | null;
}
