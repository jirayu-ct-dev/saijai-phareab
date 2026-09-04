import type {
  DeductOn,
  EntitlementStatus,
  PackageType,
  Timestamps,
  SoftDeletable,
} from "./enums";
import type { User } from "./auth";

// ============================
// PACKAGE PRODUCT
// ============================

export interface PackageProduct extends Timestamps, SoftDeletable {
  id: string;
  name: string;
  description: string | null;
  packageType: PackageType;
  isDelivery: boolean;
  deductOn: DeductOn;
  price: number | string;
  credits: number | null;
  validityDays: number | null;
  isActive: boolean;

  memberEntitlements?: MemberEntitlement[];
}

export type Package = PackageProduct;

// ============================
// MEMBER ENTITLEMENT
// ============================

export interface MemberEntitlement extends Timestamps, SoftDeletable {
  id: string;
  customerId: string;
  productId: string;
  sourceSaleItemId: string | null;
  startAt: Date | null;
  endAt: Date | null;
  activatedAt: Date | null;
  suspendedAt: Date | null;
  status: EntitlementStatus;
  creditInitial: number | null;
  creditRemaining: number | null;

  customer?: User;
  product?: PackageProduct;
}
