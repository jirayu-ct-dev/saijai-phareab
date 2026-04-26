import type { PaymentMethod, Timestamps, SoftDeletable } from "./enums";
import type { User } from "./auth";
import type { MemberEntitlement } from "./package";
import type { Image } from "./image";

// ============================
// PAYMENT RECORD
// ============================

export interface PaymentRecord extends Timestamps, SoftDeletable {
  id: string;
  userId: string;
  memberEntitlementId: string | null;
  packageSaleId: string | null;
  serviceOrderId: string | null;
  amount: number | string;
  paymentMethod: PaymentMethod;
  slipImageId: string | null;
  note: string | null;
  paidAt: Date | null;
  metadata: any | null;
  rejectionReason: string | null;
  verifiedById: string | null;
  verifiedAt: Date | null;

  user?: User;
  memberEntitlement?: MemberEntitlement | null;
  slipImage?: Image | null;
  verifiedBy?: User | null;
}
