-- Migration: db_audit_fixes
-- Addresses findings from full database architecture & security audit (2026-05-19)

-- 1. PaymentRecord: enforce at most one source FK per record.
--    A payment must be linked to at most one of: service_order, package_sale, member_entitlement.
ALTER TABLE "payment_record" ADD CONSTRAINT "payment_record_single_source"
  CHECK (
    (CASE WHEN "member_entitlement_id" IS NOT NULL THEN 1 ELSE 0 END +
     CASE WHEN "package_sale_id"        IS NOT NULL THEN 1 ELSE 0 END +
     CASE WHEN "service_order_id"       IS NOT NULL THEN 1 ELSE 0 END) <= 1
  );

-- 2. ServiceOrder: composite index for admin list queries that filter by status + deletedAt.
CREATE INDEX IF NOT EXISTS "service_order_status_deleted_created_idx"
  ON "service_order" ("status", "deleted_at", "created_at");

-- 3. MemberEntitlement: composite index for "active entitlements for a customer" queries.
CREATE INDEX IF NOT EXISTS "member_entitlement_customer_status_idx"
  ON "member_entitlement" ("customer_id", "status");

-- 4. ServiceOrder: additional indexes for admin list queries.
CREATE INDEX IF NOT EXISTS "service_order_quotation_no_idx"
  ON "service_order" ("quotation_no");

CREATE INDEX IF NOT EXISTS "service_order_status_deleted_created_idx2"
  ON "service_order" ("status", "deleted_at", "created_at");

-- 5. PackageExpiryNotification: broaden dedup key to include end_at_snapshot date.
--    This ensures re-notification fires when a package expiry date is extended.
DROP INDEX IF EXISTS "package_expiry_notification_entitlement_id_days_before_key";

ALTER TABLE "package_expiry_notification"
  ADD CONSTRAINT "package_expiry_notification_entitlement_id_days_before_end_at_snapshot_key"
  UNIQUE ("entitlement_id", "days_before", "end_at_snapshot");
