import type { BasketStatus, Timestamps, SoftDeletable } from "./enums";
import type { Order } from "./order";

// ============================
// BASKET
// ============================

export interface Basket extends Timestamps, SoftDeletable {
    id: string;
    qrCode: string | null;
    label: string | null;
    status: BasketStatus;
    isActivated: boolean;

    // Relations
    orders?: Order[];
}
