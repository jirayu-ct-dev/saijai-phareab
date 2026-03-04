// ============================
// ENUMS
// ============================

export type Role = "USER" | "EMPLOYEE" | "ADMIN";

export type OrderType = "PACKAGE" | "STOREFRONT";

export type OrderStatus =
    | "RECEIVED"
    | "PENDING"
    | "CHECKING"
    | "PROCESSING"
    | "PENDING_REVIEW"
    | "COMPLETED"
    | "CANCELLED";

export type PackageStatus = "PENDING" | "ACTIVE" | "EXPIRED";

export type BasketStatus = "AVAILABLE" | "IN_USE";

export type PackageType = "MAIN" | "ADDON";

export type PaymentStatus = "PENDING" | "VERIFIED" | "FAILED";

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
