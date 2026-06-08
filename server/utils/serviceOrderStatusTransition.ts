import type { ServiceOrderStatus } from "~~/shared/types/enums";

export const serviceOrderStatuses: ServiceOrderStatus[] = [
  "RECEIVED",
  "PROCESSING",
  "DELIVERING",
  "COMPLETED",
  "CANCELLED",
];

const allowedTransitions: Partial<Record<ServiceOrderStatus, ServiceOrderStatus[]>> = {
  RECEIVED: ["PROCESSING", "CANCELLED"],
  PROCESSING: ["DELIVERING", "CANCELLED"],
  DELIVERING: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};

export const isServiceOrderStatus = (status: unknown): status is ServiceOrderStatus =>
  typeof status === "string" && serviceOrderStatuses.includes(status as ServiceOrderStatus);

export const canTransitionServiceOrderStatus = (
  fromStatus: ServiceOrderStatus,
  toStatus: ServiceOrderStatus,
) => fromStatus === toStatus || (allowedTransitions[fromStatus] ?? []).includes(toStatus);

export const getAllowedServiceOrderTransitions = (status: ServiceOrderStatus) =>
  allowedTransitions[status] ?? [];
