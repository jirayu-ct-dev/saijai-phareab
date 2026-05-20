-- Migration: db_audit_fixes
-- Addresses findings from full database architecture & security audit (2026-05-19)

-- 1. PaymentRecord: enforce at most one source FK per record.
ALTER TABLE "payment_record" ADD CONSTRAINT "payment_record_single_source"
  CHECK (
    (CASE WHEN "memberEntitlementId" IS NOT NULL THEN 1 ELSE 0 END +
     CASE WHEN "packageSaleId"        IS NOT NULL THEN 1 ELSE 0 END +
     CASE WHEN "serviceOrderId"       IS NOT NULL THEN 1 ELSE 0 END) <= 1
  );

-- 2. ServiceOrder: composite index for admin list queries that filter by status + deletedAt.
CREATE INDEX IF NOT EXISTS "service_order_status_deletedAt_createdAt_idx"
  ON "service_order" (status, "deletedAt", "createdAt");

-- 3. ServiceOrder: index on quotationNo for fast lookup.
CREATE INDEX IF NOT EXISTS "service_order_quotationNo_idx"
  ON "service_order" ("quotationNo");

-- 4. MemberEntitlement: composite index for "active entitlements for a customer" queries.
CREATE INDEX IF NOT EXISTS "member_entitlement_customerId_status_idx"
  ON "member_entitlement" ("customerId", status);

-- 5. PackageExpiryNotification: broaden dedup key to include endAtSnapshot.
--    Ensures re-notification fires when a package expiry date is extended.
DROP INDEX IF EXISTS "package_expiry_notification_entitlementId_daysBefore_key";

ALTER TABLE "package_expiry_notification"
  ADD CONSTRAINT "package_expiry_notification_entitlementId_daysBefore_endAtSnapshot_key"
  UNIQUE ("entitlementId", "daysBefore", "endAtSnapshot");
