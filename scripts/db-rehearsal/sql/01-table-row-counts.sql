-- 01-table-row-counts.sql — checklist 8.1 (table/row preservation)
-- Aggregate-only. Safe inside a READ ONLY transaction. No PII in output.
--
-- Active = "deletedAt" IS NULL; soft_deleted = "deletedAt" IS NOT NULL.
-- Tables without a "deletedAt" column report NULL for active/soft_deleted.
-- Expected row counts come from the production snapshot in
-- docs/plan-database-consolidation.md section 2.2 (2026-09-01) — re-baseline
-- with a fresh preflight before each migration; the snapshot is not constant.

SELECT 'user' AS table_name,
       count(*) AS total_rows,
       count(*) FILTER (WHERE "deletedAt" IS NULL) AS active_rows,
       count(*) FILTER (WHERE "deletedAt" IS NOT NULL) AS soft_deleted_rows
FROM "user"
UNION ALL
SELECT 'account', count(*), NULL::bigint, NULL::bigint FROM "account"
UNION ALL
SELECT 'session', count(*), NULL::bigint, NULL::bigint FROM "session"
UNION ALL
SELECT 'verification', count(*), NULL::bigint, NULL::bigint FROM "verification"
UNION ALL
SELECT 'customer_claim_token', count(*), NULL::bigint, NULL::bigint FROM "customer_claim_token"
UNION ALL
SELECT 'package_product',
       count(*),
       count(*) FILTER (WHERE "deletedAt" IS NULL),
       count(*) FILTER (WHERE "deletedAt" IS NOT NULL)
FROM "package_product"
UNION ALL
SELECT 'package_sale',
       count(*),
       count(*) FILTER (WHERE "deletedAt" IS NULL),
       count(*) FILTER (WHERE "deletedAt" IS NOT NULL)
FROM "package_sale"
UNION ALL
SELECT 'package_sale_item', count(*), NULL::bigint, NULL::bigint FROM "package_sale_item"
UNION ALL
SELECT 'member_entitlement',
       count(*),
       count(*) FILTER (WHERE "deletedAt" IS NULL),
       count(*) FILTER (WHERE "deletedAt" IS NOT NULL)
FROM "member_entitlement"
UNION ALL
SELECT 'storefront_category',
       count(*),
       count(*) FILTER (WHERE "deletedAt" IS NULL),
       count(*) FILTER (WHERE "deletedAt" IS NOT NULL)
FROM "storefront_category"
UNION ALL
SELECT 'storefront_service',
       count(*),
       count(*) FILTER (WHERE "deletedAt" IS NULL),
       count(*) FILTER (WHERE "deletedAt" IS NOT NULL)
FROM "storefront_service"
UNION ALL
SELECT 'storefront_item',
       count(*),
       count(*) FILTER (WHERE "deletedAt" IS NULL),
       count(*) FILTER (WHERE "deletedAt" IS NOT NULL)
FROM "storefront_item"
UNION ALL
SELECT 'storefront_price',
       count(*),
       count(*) FILTER (WHERE "deletedAt" IS NULL),
       count(*) FILTER (WHERE "deletedAt" IS NOT NULL)
FROM "storefront_price"
UNION ALL
SELECT 'service_order',
       count(*),
       count(*) FILTER (WHERE "deletedAt" IS NULL),
       count(*) FILTER (WHERE "deletedAt" IS NOT NULL)
FROM "service_order"
UNION ALL
SELECT 'service_order_item',
       count(*),
       count(*) FILTER (WHERE "deletedAt" IS NULL),
       count(*) FILTER (WHERE "deletedAt" IS NOT NULL)
FROM "service_order_item"
UNION ALL
SELECT 'service_order_item_image',
       count(*),
       count(*) FILTER (WHERE "deletedAt" IS NULL),
       count(*) FILTER (WHERE "deletedAt" IS NOT NULL)
FROM "service_order_item_image"
UNION ALL
SELECT 'service_order_addon_usage', count(*), NULL::bigint, NULL::bigint FROM "service_order_addon_usage"
UNION ALL
SELECT 'payment_record',
       count(*),
       count(*) FILTER (WHERE "deletedAt" IS NULL),
       count(*) FILTER (WHERE "deletedAt" IS NOT NULL)
FROM "payment_record"
UNION ALL
SELECT 'payment_audit_log', count(*), NULL::bigint, NULL::bigint FROM "payment_audit_log"
UNION ALL
SELECT 'image',
       count(*),
       count(*) FILTER (WHERE "deletedAt" IS NULL),
       count(*) FILTER (WHERE "deletedAt" IS NOT NULL)
FROM "image"
UNION ALL
SELECT 'user_address',
       count(*),
       count(*) FILTER (WHERE "deletedAt" IS NULL),
       count(*) FILTER (WHERE "deletedAt" IS NOT NULL)
FROM "user_address"
UNION ALL
SELECT 'shop_setting', count(*), NULL::bigint, NULL::bigint FROM "shop_setting"
UNION ALL
SELECT 'business_setting', count(*), NULL::bigint, NULL::bigint FROM "business_setting"
UNION ALL
SELECT 'notification_setting', count(*), NULL::bigint, NULL::bigint FROM "notification_setting"
UNION ALL
SELECT 'notification_subscriber', count(*), NULL::bigint, NULL::bigint FROM "notification_subscriber"
UNION ALL
SELECT 'package_expiry_notification', count(*), NULL::bigint, NULL::bigint FROM "package_expiry_notification"
UNION ALL
SELECT 'expense_category',
       count(*),
       count(*) FILTER (WHERE "deletedAt" IS NULL),
       count(*) FILTER (WHERE "deletedAt" IS NOT NULL)
FROM "expense_category"
UNION ALL
SELECT 'expense',
       count(*),
       count(*) FILTER (WHERE "deletedAt" IS NULL),
       count(*) FILTER (WHERE "deletedAt" IS NOT NULL)
FROM "expense"
ORDER BY table_name;
