import type { Timestamps, SoftDeletable } from "./enums";
import type { User } from "./auth";
import type { OrderItem, Order } from "./order";
import type { PaymentTransaction } from "./payment";

export interface Image extends Timestamps, SoftDeletable {
    id: string;
    userId: string | null;
    assetId: string | null;
    publicId: string | null;
    url: string | null;
    secureUrl: string | null;

    // Relations
    user?: User | null;
    orderItems?: OrderItem[];
    orders?: Order[];
    slipPayments?: PaymentTransaction[];
}
