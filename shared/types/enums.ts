// ============================
// ENUMS
// ============================

export type Role = "USER" | "EMPLOYEE" | "ADMIN";

export type OrderType = "PACKAGE" | "STOREFRONT";

export type ServiceOrderStatus =
    | "RECEIVED"
    | "PROCESSING"
    | "DELIVERING"
    | "COMPLETED"
    | "CANCELLED";

export type OrderStatus = ServiceOrderStatus;

export type PackageSaleStatus = "DRAFT" | "PENDING" | "PAID" | "CANCELLED";

export type EntitlementStatus =
    | "PENDING"
    | "ACTIVE"
    | "SUSPENDED"
    | "EXPIRED"
    | "CANCELLED";

export type PackageStatus = EntitlementStatus;

export type PackageType = "MAIN" | "ADDON";
export type DeductOn = "CREATED" | "COMPLETED";

export type PaymentMethod = "CASH" | "TRANSFER";

export type PaymentStatus =
    | "UNPAID"
    | "PENDING_VERIFICATION"
    | "PAID"
    | "CANCELLED";

// ============================
// SOFT DELETE (shared fields)
// ============================

export interface SoftDeletable {
    deletedAt: Date | null;
    deletedById: string | null;
}

// ============================
// TIMESTAMPS (shared fields)
// ============================

export interface Timestamps {
    createdAt: Date;
    updatedAt: Date;
}
