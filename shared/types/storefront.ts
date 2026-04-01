import type { Timestamps, SoftDeletable } from "./enums";
import type { OrderItem } from "./order";

// ============================
// STOREFRONT SERVICE
// ============================

export interface StorefrontService extends Timestamps, SoftDeletable {
    id: string;
    name: string;
    description: string | null;
    isActive: boolean;

    // Relations
    storefrontPrices?: StorefrontPrice[];
}

// ============================
// STOREFRONT ITEM
// ============================

export interface StorefrontItem extends Timestamps, SoftDeletable {
    id: string;
    name: string;
    description: string | null;
    isActive: boolean;

    // Relations
    storefrontPrices?: StorefrontPrice[];
}

// ============================
// STOREFRONT PRICE
// ============================

export interface StorefrontPrice extends Timestamps, SoftDeletable {
    id: string;
    storefrontServiceId: string;
    storefrontItemId: string;
    price: number | string; // mapped from Decimal
    isActive: boolean;

    // Relations
    storefrontService?: StorefrontService;
    storefrontItem?: StorefrontItem;
    orderItems?: OrderItem[];
}
