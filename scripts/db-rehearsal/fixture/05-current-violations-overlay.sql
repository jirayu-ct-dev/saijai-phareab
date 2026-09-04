-- Constraint-valid row that deliberately violates the refund lifecycle gate.
INSERT INTO "service_order_addon_usage" (
  id, "serviceOrderId", "memberEntitlementId", "productName", credits,
  "deductedAt", "refundedAt", "updatedAt"
) VALUES (
  'cfx_bad_refund', 'cfx_order_open', 'cfx_entitlement', 'Invalid refund fixture', 1,
  NULL, now(), now()
);
