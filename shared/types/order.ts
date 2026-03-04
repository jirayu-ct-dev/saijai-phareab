import type { OrderType, OrderStatus, Timestamps, SoftDeletable } from "./enums";
import type { User } from "./auth";
import type { UserPackage } from "./package";
import type { Basket } from "./basket";
import type { Image } from "./image";
import type { StorefrontPrice } from "./storefront";

// ============================
// ORDER
// ============================

// JSON types for specific fields
export interface HangerCharge {
    count: number;
    pricePerUnit: number;
    total: number;
}

export interface UsedBonus {
    packageBonusId: string;
    quantity: number;
    description: string;
}

export interface DeliveryAddressSnapshot {
    contactName: string;
    contactPhone: string;
    addressLine: string;
    subDistrict: string;
    district: string;
    province: string;
    postalCode: string;
    latitude: number | null;
    longitude: number | null;
}

export interface Order extends Timestamps, SoftDeletable {
    id: string;
    customerId: string;
    employeeId: string | null;
    orderType: OrderType;
    currentStatus: OrderStatus;
    isWalkIn: boolean;
    walkInName: string | null;
    walkInPhone: string | null;
    userPackageId: string | null;
    creditUsed: number | null;
    hangerCharge: HangerCharge | null; // json
    totalAmount: number | string | null; // decimal
    basketId: string | null;
    note: string | null;
    usedBonuses: UsedBonus[] | null; // json array
    deliveryAddressSnapshot: DeliveryAddressSnapshot | null; // json
    imageId: string | null;

    // Relations
    customer?: User;
    employee?: User | null;
    userPackage?: UserPackage | null;
    basket?: Basket | null;
    image?: Image | null;
    orderItems?: OrderItem[];
}

// ============================
// ORDER ITEM
// ============================

export interface OrderItem extends Timestamps, SoftDeletable {
    id: string;
    orderId: string;
    storefrontPriceId: string;
    isPackageIncluded: boolean;
    quantity: number;
    unitPrice: number | string; // decimal
    totalPrice: number | string; // decimal
    imageId: string | null;
    notes: string | null;

    // Relations
    order?: Order;
    storefrontPrice?: StorefrontPrice;
    image?: Image | null;
}
