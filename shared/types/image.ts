import type { Timestamps, SoftDeletable } from "./enums";
import type { User } from "./auth";
import type { OrderItem, Order } from "./order";
import type { PaymentTransaction } from "./payment";

export interface Image extends Timestamps, SoftDeletable {
    id: string;
    assetId: string | null;
    publicId: string | null;
    url: string | null;
    secureUrl: string | null;

    // Relations
    users?: User[];
    orderItems?: OrderItem[];
    orders?: Order[];
    slipPayments?: PaymentTransaction[];
}
