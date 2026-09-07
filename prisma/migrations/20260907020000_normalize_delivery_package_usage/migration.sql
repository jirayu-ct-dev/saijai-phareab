-- Delivery packages represent an active entitlement and record actual use per
-- service order. They do not own or deduct credits.
BEGIN;

UPDATE "package_product"
SET
  "deductOn" = 'CREATED',
  "credits" = NULL
WHERE "isDelivery" = true;

UPDATE "member_entitlement"
SET
  "creditInitial" = NULL,
  "creditRemaining" = NULL
WHERE "productId" IN (
  SELECT "id" FROM "package_product" WHERE "isDelivery" = true
);

UPDATE "service_order_addon_usage"
SET
  "credits" = 0,
  "deductOn" = 'CREATED',
  "isDelivery" = true,
  "deductedAt" = NULL,
  "refundedAt" = NULL
WHERE "productId" IN (
  SELECT "id" FROM "package_product" WHERE "isDelivery" = true
);

-- Credit-based add-ons now follow the same immediate deduction timing as the
-- main package. Existing usage rows keep their historical timing.
UPDATE "package_product"
SET "deductOn" = 'CREATED'
WHERE "packageType" = 'ADDON';

COMMIT;
