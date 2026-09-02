-- 8.0 Server and migration context.
-- Aggregate-only. Safe inside a READ ONLY transaction. No PII in output.

WITH migration_status AS (
  SELECT count(*) AS migration_rows,
         count(*) FILTER (WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL) AS applied_rows,
         count(*) FILTER (WHERE finished_at IS NULL AND rolled_back_at IS NULL) AS unfinished_rows,
         count(*) FILTER (WHERE rolled_back_at IS NOT NULL) AS rolled_back_rows
  FROM "_prisma_migrations"
)
SELECT 'server_and_migration_context' AS check_id,
       current_setting('server_version_num')::int AS server_version_num,
       current_setting('transaction_read_only') = 'on' AS transaction_read_only,
       pg_is_in_recovery() AS is_replica,
       migration_rows,
       applied_rows,
       unfinished_rows,
       rolled_back_rows,
       (unfinished_rows = 0) AS pass
FROM migration_status;
