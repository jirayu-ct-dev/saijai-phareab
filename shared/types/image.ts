import type { Timestamps, SoftDeletable } from "./enums";
import type { User } from "./auth";
import type { ServiceOrderItem, ServiceOrder } from "./order";
import type { PaymentRecord } from "./payment";

export interface Image extends Timestamps, SoftDeletable {
    id: string;
    userId: string | null;
    assetId: string | null;
    publicId: string | null;
    url: string | null;
    secureUrl: string | null;

    // Relations
    user?: User | null;
    serviceOrderItemImages?: Array<{ serviceOrderItem?: ServiceOrderItem }>;
    serviceOrders?: ServiceOrder[];
    slipPayments?: PaymentRecord[];
}
