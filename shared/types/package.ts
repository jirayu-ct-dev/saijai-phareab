import type { PackageType, PackageStatus, Timestamps, SoftDeletable } from "./enums";
import type { User } from "./auth";
import type { StorefrontPrice } from "./storefront";
import type { Order } from "./order";
import type { PaymentTransaction } from "./payment";

// ============================
// PACKAGE
// ============================

export interface Package extends Timestamps, SoftDeletable {
    id: string;
    name: string;
    description: string | null;
    packageType: PackageType;
    price: number | string; // Decimal from Prisma usually maps to number/string or Decimal instance
    credits: number | null;
    bonusCredits: number | null;
    validityDays: number | null;
    isActive: boolean;

    // Relations
    packageBonuses?: PackageBonus[];
    userPackages?: UserPackage[];
    bundledAddons?: PackageBundle[];
    includedInBundles?: PackageBundle[];
}

// ============================
// PACKAGE BONUS
// ============================

export interface PackageBonus extends Timestamps, SoftDeletable {
    id: string;
    packageId: string;
    storefrontPriceId: string;
    quantity: number;
    description: string | null;

    // Relations
    package?: Package;
    storefrontPrice?: StorefrontPrice;
}

// ============================
// PACKAGE BUNDLE
// ============================

export interface PackageBundle {
    id: string;
    mainPackageId: string;
    addonPackageId: string;
    quantity: number;
    createdAt: Date;
    updatedAt: Date;

    // Relations
    mainPackage?: Package;
    addonPackage?: Package;
}

// ============================
// USER PACKAGE
// ============================

export interface UserPackage extends Timestamps, SoftDeletable {
    id: string;
    userId: string;
    packageId: string;
    parentUserPackageId: string | null;
    startDate: Date | null;
    endDate: Date | null;
    status: PackageStatus;
    creditRemain: number | null;

    // Relations
    user?: User;
    package?: Package;
    parentUserPackage?: UserPackage | null;
    addonPackages?: UserPackage[];
    orders?: Order[];
    paymentTransactions?: PaymentTransaction[];
}
