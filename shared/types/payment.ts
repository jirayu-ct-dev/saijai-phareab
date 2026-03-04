import type { PaymentStatus, Timestamps, SoftDeletable } from "./enums";
import type { User } from "./auth";
import type { UserPackage } from "./package";
import type { Image } from "./image";

// ============================
// PAYMENT TRANSACTION
// ============================

export interface PaymentTransaction extends Timestamps, SoftDeletable {
    id: string;
    userId: string;
    userPackageId: string;
    amount: number | string; // decimal
    slipImageId: string | null;
    status: PaymentStatus;
    verifiedById: string | null;
    verifiedAt: Date | null;

    // Relations
    user?: User;
    userPackage?: UserPackage;
    slipImage?: Image | null;
    verifiedBy?: User | null;
}
