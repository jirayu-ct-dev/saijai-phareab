-- 06-payments.sql — checklist 8.6 (payment source/cardinality/consistency)
-- Aggregate-only. Safe inside a READ ONLY transaction. No PII in output.
--
-- Policy (master plan C5 / plan F1): a payment has exactly one source between
-- "packageSaleId" and "serviceOrderId"; each source has at most one payment
-- over its lifetime (soft-deleted included). Amount comparisons are numeric
-- (= / <>) on PostgreSQL numeric columns — never float.

SELECT 'payment_source_zero' AS check_id,
       count(*) AS violating_rows,
       (count(*) = 0) AS pass
FROM "payment_record"
WHERE "serviceOrderId" IS NULL AND "packageSaleId" IS NULL
UNION ALL
SELECT 'payment_source_multiple',
       count(*),
       (count(*) = 0)
FROM "payment_record"
WHERE "serviceOrderId" IS NOT NULL AND "packageSaleId" IS NOT NULL
UNION ALL
-- Legacy third source: report-only context. The db_audit_fixes CHECK
-- constraint treats memberEntitlementId as a source too.
SELECT 'payment_with_member_entitlement_id',
       count(*),
       true
FROM "payment_record"
WHERE "memberEntitlementId" IS NOT NULL
UNION ALL
-- Lifetime cardinality per source, soft-deleted payments included. Expect 0
-- under F1.
SELECT 'service_order_with_multiple_payments_ever',
       count(*),
       (count(*) = 0)
FROM (
  SELECT "serviceOrderId"
  FROM "payment_record"
  WHERE "serviceOrderId" IS NOT NULL
  GROUP BY "serviceOrderId"
  HAVING count(*) > 1
) s
UNION ALL
SELECT 'package_sale_with_multiple_payments_ever',
       count(*),
       (count(*) = 0)
FROM (
  SELECT "packageSaleId"
  FROM "payment_record"
  WHERE "packageSaleId" IS NOT NULL
  GROUP BY "packageSaleId"
  HAVING count(*) > 1
) s
UNION ALL
-- payment.userId must equal the source customer.
SELECT 'payment_user_vs_service_order_customer_mismatch',
       count(*),
       (count(*) = 0)
FROM "payment_record" p
JOIN "service_order" so ON so.id = p."serviceOrderId"
WHERE p."serviceOrderId" IS NOT NULL
  AND p."userId" <> so."customerId"
UNION ALL
SELECT 'payment_user_vs_package_sale_customer_mismatch',
       count(*),
       (count(*) = 0)
FROM "payment_record" p
JOIN "package_sale" ps ON ps.id = p."packageSaleId"
WHERE p."packageSaleId" IS NOT NULL
  AND p."userId" <> ps."customerId"
UNION ALL
-- Amount match, exact numeric comparison. service_order.totalAmount is
-- nullable: uncomparable rows are reported separately, never as a match.
SELECT 'payment_amount_vs_service_order_total_mismatch',
       count(*),
       (count(*) = 0)
FROM "payment_record" p
JOIN "service_order" so ON so.id = p."serviceOrderId"
WHERE p."serviceOrderId" IS NOT NULL
  AND so."totalAmount" IS NOT NULL
  AND p.amount <> so."totalAmount"
UNION ALL
SELECT 'payment_amount_vs_service_order_total_uncomparable',
       count(*),
       true
FROM "payment_record" p
JOIN "service_order" so ON so.id = p."serviceOrderId"
WHERE p."serviceOrderId" IS NOT NULL
  AND so."totalAmount" IS NULL
UNION ALL
SELECT 'payment_amount_vs_package_sale_total_mismatch',
       count(*),
       (count(*) = 0)
FROM "payment_record" p
JOIN "package_sale" ps ON ps.id = p."packageSaleId"
WHERE p."packageSaleId" IS NOT NULL
  AND p.amount <> ps."totalAmount"
UNION ALL
-- PackageSale.status must equal the presentation mapping of PaymentRecord.status
-- (UNPAID/PENDING_VERIFICATION -> PENDING, PAID -> PAID, CANCELLED -> CANCELLED).
SELECT 'package_sale_status_vs_payment_mapping_mismatch',
       count(*),
       (count(*) = 0)
FROM "package_sale" ps
JOIN "payment_record" p ON p."packageSaleId" = ps.id
WHERE CASE p.status
    WHEN 'UNPAID' THEN 'PENDING'::"PackageSaleStatus"
    WHEN 'PENDING_VERIFICATION' THEN 'PENDING'::"PackageSaleStatus"
    WHEN 'PAID' THEN 'PAID'::"PackageSaleStatus"
    WHEN 'CANCELLED' THEN 'CANCELLED'::"PackageSaleStatus"
  END IS DISTINCT FROM ps.status
UNION ALL
-- Sales that are not DRAFT but have no payment row at all.
SELECT 'package_sale_without_payment_non_draft',
       count(*),
       (count(*) = 0)
FROM "package_sale" ps
WHERE ps.status <> 'DRAFT'
  AND NOT EXISTS (SELECT 1 FROM "payment_record" p WHERE p."packageSaleId" = ps.id)
UNION ALL
-- PAID invariants: paidAt, confirmedAt, receiptNo present.
SELECT 'paid_payment_missing_paid_at',
       count(*),
       (count(*) = 0)
FROM "payment_record"
WHERE status = 'PAID' AND "paidAt" IS NULL
UNION ALL
SELECT 'paid_payment_missing_confirmed_at',
       count(*),
       (count(*) = 0)
FROM "payment_record"
WHERE status = 'PAID' AND "confirmedAt" IS NULL
UNION ALL
SELECT 'paid_payment_missing_receipt_no',
       count(*),
       (count(*) = 0)
FROM "payment_record"
WHERE status = 'PAID' AND "receiptNo" IS NULL
UNION ALL
-- Delete-state symmetry: an active source must have an active payment and an
-- active payment must have an active source.
SELECT 'active_service_order_without_active_payment',
       count(*),
       (count(*) = 0)
FROM "service_order" so
WHERE so."deletedAt" IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM "payment_record" p
    WHERE p."serviceOrderId" = so.id AND p."deletedAt" IS NULL
  )
UNION ALL
SELECT 'active_package_sale_without_active_payment',
       count(*),
       (count(*) = 0)
FROM "package_sale" ps
WHERE ps."deletedAt" IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM "payment_record" p
    WHERE p."packageSaleId" = ps.id AND p."deletedAt" IS NULL
  )
UNION ALL
SELECT 'active_payment_with_deleted_service_order_source',
       count(*),
       (count(*) = 0)
FROM "payment_record" p
JOIN "service_order" so ON so.id = p."serviceOrderId"
WHERE p."deletedAt" IS NULL
  AND so."deletedAt" IS NOT NULL
UNION ALL
SELECT 'active_payment_with_deleted_package_sale_source',
       count(*),
       (count(*) = 0)
FROM "payment_record" p
JOIN "package_sale" ps ON ps.id = p."packageSaleId"
WHERE p."deletedAt" IS NULL
  AND ps."deletedAt" IS NOT NULL
UNION ALL
-- Baseline histograms (context for evidence; compare with the section 2.2
-- snapshot: active PAID/UNPAID split, deleted split).
SELECT 'payment_active_paid_count',
       count(*) FILTER (WHERE status = 'PAID'),
       true
FROM "payment_record"
WHERE "deletedAt" IS NULL
UNION ALL
SELECT 'payment_active_unpaid_count',
       count(*) FILTER (WHERE status = 'UNPAID'),
       true
FROM "payment_record"
WHERE "deletedAt" IS NULL
UNION ALL
SELECT 'payment_soft_deleted_count',
       count(*),
       true
FROM "payment_record"
WHERE "deletedAt" IS NOT NULL;
