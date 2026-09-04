-- Aggregate-only checks for the post-consolidation schema. No PII is returned.

SELECT 'app_setting_singleton' AS check_id, count(*) AS violating_rows,
       count(*) = 0 AS pass
FROM "business_setting"
HAVING count(*) <> 1 OR count(*) FILTER (WHERE id = 'singleton') <> 1
UNION ALL
SELECT 'app_setting_required_fields', count(*), count(*) = 0
FROM "business_setting"
WHERE "name" IS NULL OR "phone" IS NULL OR "address" IS NULL
   OR "lineQrEnabled" IS NULL OR "notifyCustomerOnQuotation" IS NULL
   OR "notifyCustomerOnReceived" IS NULL OR "notifyCustomerOnProcessing" IS NULL
   OR "notifyCustomerOnDelivering" IS NULL OR "notifyCustomerOnCompleted" IS NULL
   OR "notifyCustomerOnCancelled" IS NULL OR "notifyCustomerReceipt" IS NULL
   OR "notifyStaffOnNewOrder" IS NULL OR "notifyCustomerOnPackageExpiring" IS NULL
UNION ALL
SELECT 'active_subscriber_policy', count(*), count(*) = 0
FROM "notification_subscriber" subscriber
JOIN "user" account ON account.id = subscriber."userId"
WHERE subscriber."isActive" = true
  AND (account."deletedAt" IS NOT NULL OR account."isActive" = false OR account.role NOT IN ('ADMIN', 'EMPLOYEE'))
UNION ALL
SELECT 'ledger_refunded_without_deducted', count(*), count(*) = 0
FROM "service_order_addon_usage"
WHERE "refundedAt" IS NOT NULL AND "deductedAt" IS NULL
UNION ALL
SELECT 'ledger_rows_without_entitlement', count(*), count(*) = 0
FROM "service_order_addon_usage" usage
LEFT JOIN "member_entitlement" entitlement ON entitlement.id = usage."memberEntitlementId"
WHERE usage."memberEntitlementId" IS NOT NULL AND entitlement.id IS NULL
UNION ALL
SELECT 'duplicate_active_item_image_pairs', count(*), count(*) = 0
FROM (
  SELECT "serviceOrderItemId", "imageId"
  FROM "service_order_item_image"
  WHERE "deletedAt" IS NULL
  GROUP BY "serviceOrderItemId", "imageId"
  HAVING count(*) > 1
) duplicates
UNION ALL
SELECT 'join_rows_without_image_row', count(*), count(*) = 0
FROM "service_order_item_image" photo
LEFT JOIN "image" asset ON asset.id = photo."imageId"
WHERE asset.id IS NULL
UNION ALL
SELECT 'payment_source_not_exactly_one', count(*), count(*) = 0
FROM "payment_record"
WHERE ("packageSaleId" IS NULL) = ("serviceOrderId" IS NULL)
UNION ALL
SELECT 'service_order_with_multiple_payments', count(*), count(*) = 0
FROM (SELECT "serviceOrderId" FROM "payment_record" WHERE "serviceOrderId" IS NOT NULL GROUP BY "serviceOrderId" HAVING count(*) > 1) duplicates
UNION ALL
SELECT 'package_sale_with_multiple_payments', count(*), count(*) = 0
FROM (SELECT "packageSaleId" FROM "payment_record" WHERE "packageSaleId" IS NOT NULL GROUP BY "packageSaleId" HAVING count(*) > 1) duplicates
UNION ALL
SELECT 'payment_user_vs_source_customer_mismatch', count(*), count(*) = 0
FROM "payment_record" payment
LEFT JOIN "service_order" order_row ON order_row.id = payment."serviceOrderId"
LEFT JOIN "package_sale" sale ON sale.id = payment."packageSaleId"
WHERE payment."userId" IS DISTINCT FROM COALESCE(order_row."customerId", sale."customerId")
UNION ALL
SELECT 'payment_amount_vs_source_total_mismatch', count(*), count(*) = 0
FROM "payment_record" payment
LEFT JOIN "service_order" order_row ON order_row.id = payment."serviceOrderId"
LEFT JOIN "package_sale" sale ON sale.id = payment."packageSaleId"
WHERE COALESCE(order_row."totalAmount", sale."totalAmount") IS NOT NULL
  AND payment.amount IS DISTINCT FROM COALESCE(order_row."totalAmount", sale."totalAmount")
UNION ALL
SELECT 'source_without_payment', count(*), count(*) = 0
FROM (
  SELECT order_row.id
  FROM "service_order" order_row
  LEFT JOIN "payment_record" payment ON payment."serviceOrderId" = order_row.id
  WHERE payment.id IS NULL
  UNION ALL
  SELECT sale.id
  FROM "package_sale" sale
  LEFT JOIN "payment_record" payment ON payment."packageSaleId" = sale.id
  WHERE payment.id IS NULL
) missing
UNION ALL
SELECT 'paid_payment_missing_completion_fields', count(*), count(*) = 0
FROM "payment_record"
WHERE status = 'PAID' AND ("paidAt" IS NULL OR "confirmedAt" IS NULL OR "receiptNo" IS NULL)
UNION ALL
SELECT 'completed_at_on_non_completed_order', count(*), count(*) = 0
FROM "service_order"
WHERE status <> 'COMPLETED' AND "completedAt" IS NOT NULL
UNION ALL
SELECT 'legacy_schema_removed',
       CASE WHEN legacy_removed THEN 0 ELSE 1 END,
       legacy_removed
FROM (
  SELECT (
         to_regclass('public.shop_setting') IS NULL
         AND to_regclass('public.notification_setting') IS NULL
         AND to_regtype('public."PackageSaleStatus"') IS NULL
         AND NOT EXISTS (
           SELECT 1 FROM information_schema.columns
           WHERE table_schema = 'public' AND (
             (table_name = 'service_order' AND column_name IN ('addonUsages', 'usedBonuses'))
             OR (table_name = 'service_order_item' AND column_name = 'imageId')
             OR (table_name = 'payment_record' AND column_name = 'memberEntitlementId')
             OR (table_name = 'package_sale' AND column_name = 'status')
           )
         )
       ) AS legacy_removed
) schema_state;
