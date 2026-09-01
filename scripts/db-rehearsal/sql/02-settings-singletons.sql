-- 02-settings-singletons.sql — checklist 8.2 (settings singletons)
-- Aggregate-only. Safe inside a READ ONLY transaction. No PII in output.
--
-- pass = true requires exactly one row and its id = 'singleton'.

SELECT 'shop_setting' AS check_id,
       count(*) AS total_rows,
       count(*) FILTER (WHERE id = 'singleton') AS singleton_rows,
       (count(*) = 1 AND count(*) FILTER (WHERE id = 'singleton') = 1) AS pass
FROM "shop_setting"
UNION ALL
SELECT 'business_setting',
       count(*),
       count(*) FILTER (WHERE id = 'singleton'),
       (count(*) = 1 AND count(*) FILTER (WHERE id = 'singleton') = 1)
FROM "business_setting"
UNION ALL
SELECT 'notification_setting',
       count(*),
       count(*) FILTER (WHERE id = 'singleton'),
       (count(*) = 1 AND count(*) FILTER (WHERE id = 'singleton') = 1)
FROM "notification_setting";
