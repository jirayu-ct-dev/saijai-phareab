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
    userPackageId: string | null;
    orderId: string | null;
    amount: number | string; // decimal
    slipImageId: string | null;
    status: PaymentStatus;
    
    // Slip2Go Fields
    referenceNo: string | null;
    senderName: string | null;
    senderBank: string | null;
    receiverAccount: string | null;
    slipPayload: any | null;
    rejectionReason: string | null;

    verifiedById: string | null;
    verifiedAt: Date | null;

    // Relations
    user?: User;
    userPackage?: UserPackage | null;
    order?: any | null; // using any if Order isn't imported, but assuming it will be 
    slipImage?: Image | null;
    verifiedBy?: User | null;
}
