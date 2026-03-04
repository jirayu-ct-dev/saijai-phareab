import type { Timestamps, SoftDeletable } from "./enums";
import type { User } from "./auth";

// ============================
// USER ADDRESS
// ============================

export interface UserAddress extends Timestamps, SoftDeletable {
    id: string;
    userId: string;
    address: string | null;
    subdistrict: string | null;
    district: string | null;
    province: string | null;
    postalCode: string | null;
    latitude: number | string | null; // decimal
    longitude: number | string | null; // decimal
    isDefault: boolean;

    // Relations
    user?: User;
}
