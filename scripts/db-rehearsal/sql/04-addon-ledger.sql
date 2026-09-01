-- 04-addon-ledger.sql — checklist 8.4 (add-on ledger)
-- Aggregate-only. Safe inside a READ ONLY transaction. No PII in output.
--
-- service_order."addonUsages" is JSONB, an array of StoredAddonUsage:
--   { entitlementId, productId?, productName?, credits, deductOn?,
--     isDelivery?, appliedAt?, deductedAt?, refundedAt? }
-- (shape source: server/utils/serviceOrderCredits.ts parseAddonUsages)
-- service_order."usedBonuses" is a legacy JSON column with no known active
-- consumer; report non-empty counts only, never the payloads.

SELECT 'orders_with_nonempty_addon_usages_json' AS check_id,
       count(*) AS value
FROM "service_order"
WHERE "addonUsages" IS NOT NULL
  AND jsonb_typeof("addonUsages") = 'array'
  AND jsonb_array_length("addonUsages") > 0
UNION ALL
SELECT 'orders_with_non_array_addon_usages_json',
       count(*)
FROM "service_order"
WHERE "addonUsages" IS NOT NULL
  AND jsonb_typeof("addonUsages") IS DISTINCT FROM 'array'
UNION ALL
SELECT 'orders_with_malformed_addon_usages_entries',
       count(*)
FROM "service_order" so
WHERE so."addonUsages" IS NOT NULL
  AND jsonb_typeof(so."addonUsages") = 'array'
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements(
      CASE WHEN jsonb_typeof(so."addonUsages") = 'array'
           THEN so."addonUsages"
           ELSE '[]'::jsonb END
    ) AS entry
    WHERE jsonb_typeof(entry) IS DISTINCT FROM 'object'
       OR COALESCE(entry ->> 'entitlementId', '') = ''
       OR COALESCE(entry ->> 'credits', '0') !~ '^[0-9]+$'
       OR (entry ->> 'credits')::numeric <= 0
  )
UNION ALL
SELECT 'orders_with_nonempty_used_bonuses_json',
       count(*)
FROM "service_order"
WHERE "usedBonuses" IS NOT NULL
  AND "usedBonuses"::text IS DISTINCT FROM 'null'
  AND (
    jsonb_typeof("usedBonuses") IS DISTINCT FROM 'array'
    OR jsonb_array_length("usedBonuses") > 0
  )
UNION ALL
SELECT 'addon_usage_ledger_rows',
       count(*)
FROM "service_order_addon_usage"
UNION ALL
SELECT 'addon_usage_ledger_orders_covered',
       count(DISTINCT "serviceOrderId")
FROM "service_order_addon_usage"
UNION ALL
-- Orders that still carry non-empty legacy JSON but have no normalized rows
-- yet: these are the only legitimate backfill targets. Expect 0 in the
-- 2026-09-01 production snapshot.
SELECT 'json_orders_without_ledger_rows',
       count(*)
FROM "service_order" so
WHERE so."addonUsages" IS NOT NULL
  AND jsonb_typeof(so."addonUsages") = 'array'
  AND jsonb_array_length(so."addonUsages") > 0
  AND NOT EXISTS (
    SELECT 1 FROM "service_order_addon_usage" au WHERE au."serviceOrderId" = so.id
  )
UNION ALL
-- Refund-before-deduct would double-credit on refund replay.
SELECT 'ledger_refunded_without_deducted',
       count(*)
FROM "service_order_addon_usage"
WHERE "refundedAt" IS NOT NULL
  AND "deductedAt" IS NULL
UNION ALL
-- Ledger rows pointing at an entitlement that no longer exists.
SELECT 'ledger_rows_without_entitlement',
       count(*)
FROM "service_order_addon_usage" au
LEFT JOIN "member_entitlement" me ON me.id = au."memberEntitlementId"
WHERE au."memberEntitlementId" IS NOT NULL
  AND me.id IS NULL
UNION ALL
-- Credits consistency: for every (order, entitlement) pair present in both
-- the legacy JSON and the normalized ledger, the summed credits must match.
-- Expect 0 mismatches.
SELECT 'credits_json_vs_ledger_mismatched_pairs',
       count(*)
FROM (
  SELECT so.id AS order_id,
         entry ->> 'entitlementId' AS entitlement_id,
         sum((entry ->> 'credits')::numeric) AS json_credits
  FROM "service_order" so
  CROSS JOIN LATERAL jsonb_array_elements(
    CASE WHEN jsonb_typeof(so."addonUsages") = 'array'
         THEN so."addonUsages"
         ELSE '[]'::jsonb END
  ) AS entry
  WHERE so."addonUsages" IS NOT NULL
    AND jsonb_typeof(so."addonUsages") = 'array'
    AND COALESCE(entry ->> 'entitlementId', '') <> ''
    AND entry ->> 'credits' ~ '^[0-9]+$'
  GROUP BY so.id, entry ->> 'entitlementId'
) j
JOIN (
  SELECT au."serviceOrderId" AS order_id,
         au."memberEntitlementId" AS entitlement_id,
         sum(au.credits) AS ledger_credits
  FROM "service_order_addon_usage" au
  WHERE au."memberEntitlementId" IS NOT NULL
  GROUP BY au."serviceOrderId", au."memberEntitlementId"
) l
  ON l.order_id = j.order_id
 AND l.entitlement_id = j.entitlement_id
WHERE l.ledger_credits::numeric <> j.json_credits;
