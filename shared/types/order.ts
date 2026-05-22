import type { ServiceOrderStatus, Timestamps, SoftDeletable } from "./enums";
import type { User } from "./auth";
import type { MemberEntitlement } from "./package";
import type { Basket } from "./basket";
import type { Image } from "./image";
import type { StorefrontPrice } from "./storefront";

// ============================
// SERVICE ORDER
// ============================

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

export interface ServiceOrder extends Timestamps, SoftDeletable {
  id: string;
  customerId: string;
  employeeId: string | null;
  status: ServiceOrderStatus;
  isWalkIn: boolean;
  walkInName: string | null;
  walkInPhone: string | null;
  memberEntitlementId: string | null;
  creditUsed: number | null;
  hangerCharge: HangerCharge | null;
  totalAmount: number | string | null;
  basketId: string | null;
  note: string | null;
  usedBonuses: UsedBonus[] | null;
  deliveryAddressSnapshot: DeliveryAddressSnapshot | null;
  imageId: string | null;

  customer?: User;
  employee?: User | null;
  memberEntitlement?: MemberEntitlement | null;
  basket?: Basket | null;
  image?: Image | null;
  items?: ServiceOrderItem[];
}

export interface ServiceOrderItem extends Timestamps, SoftDeletable {
  id: string;
  serviceOrderId: string;
  storefrontPriceId: string;
  isPackageIncluded: boolean;
  quantity: number;
  unitPrice: number | string;
  totalPrice: number | string;
  imageId: string | null;
  notes: string | null;

  serviceOrder?: ServiceOrder;
  storefrontPrice?: StorefrontPrice;
  image?: Image | null;
}

// Compatibility aliases for older UI code.
export type Order = ServiceOrder & {
  orderType?: "STOREFRONT";
  currentStatus?: ServiceOrderStatus;
  orderItems?: ServiceOrderItem[];
};
export type OrderItem = ServiceOrderItem & {
  order?: Order;
};
