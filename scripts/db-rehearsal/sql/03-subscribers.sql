-- 03-subscribers.sql — checklist 8.3 (subscriber invariants)
-- Aggregate-only. Safe inside a READ ONLY transaction. No PII in output.
--
-- Policy (docs/plan-database-consolidation.md 8.3):
--   * subscriber whose user cannot be found must be 0
--   * active subscriber must belong to a non-deleted, active ADMIN/EMPLOYEE
-- There is no subscriber migration/backfill in this round; report only.

SELECT 'subscriber_without_user' AS check_id,
       count(*) AS violating_rows,
       (count(*) = 0) AS pass
FROM "notification_subscriber" ns
LEFT JOIN "user" u ON u.id = ns."userId"
WHERE u.id IS NULL
UNION ALL
SELECT 'active_subscriber_policy',
       count(*),
       (count(*) = 0)
FROM "notification_subscriber" ns
JOIN "user" u ON u.id = ns."userId"
WHERE ns."isActive" = true
  AND (
    u."deletedAt" IS NOT NULL
    OR u."isActive" = false
    OR u.role NOT IN ('ADMIN', 'EMPLOYEE')
  )
UNION ALL
SELECT 'subscriber_totals',
       count(*),
       true
FROM "notification_subscriber"
UNION ALL
SELECT 'subscriber_active_count',
       count(*) FILTER (WHERE "isActive" = true),
       true
FROM "notification_subscriber"
UNION ALL
SELECT 'subscriber_inactive_count',
       count(*) FILTER (WHERE "isActive" = false),
       true
FROM "notification_subscriber";
