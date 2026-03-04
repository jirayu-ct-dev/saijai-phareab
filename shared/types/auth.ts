import type { Role, Timestamps, SoftDeletable } from "./enums";

// ============================
// USER
// ============================

export interface User extends Timestamps, SoftDeletable {
    id: string;
    email: string;
    name: string | null;
    emailVerified: boolean;
    image: string | null;
    imageId: string | null;
    role: Role;
    phoneNumber: string | null;

    // Relations (optional - populated when included)
    profileImage?: Image | null;
    sessions?: Session[];
    accounts?: Account[];
    userPackages?: UserPackage[];
    customerOrders?: Order[];
    userAddresses?: UserAddress[];
}

// ============================
// SESSION (Better Auth)
// ============================

export interface Session extends Timestamps {
    id: string;
    expiresAt: Date;
    token: string;
    ipAddress: string | null;
    userAgent: string | null;
    userId: string;

    // Relations
    user?: User;
}

// ============================
// ACCOUNT (Better Auth)
// ============================

export interface Account extends Timestamps {
    id: string;
    accountId: string;
    providerId: string;
    userId: string;
    accessToken: string | null;
    refreshToken: string | null;
    idToken: string | null;
    accessTokenExpiresAt: Date | null;
    refreshTokenExpiresAt: Date | null;
    scope: string | null;
    password: string | null;

    // Relations
    user?: User;
}

// ============================
// VERIFICATION (Better Auth)
// ============================

export interface Verification {
    id: string;
    identifier: string;
    value: string;
    expiresAt: Date;
    createdAt: Date;
    updatedAt: Date;
}

// Forward declarations for circular refs
import type { Image } from "./image";
import type { UserPackage } from "./package";
import type { Order } from "./order";
import type { UserAddress } from "./address";
