SELECT 'server_and_migration_context' AS check_id,
       current_setting('transaction_read_only') = 'on' AS transaction_read_only,
       count(*) FILTER (WHERE finished_at IS NULL AND rolled_back_at IS NULL) AS unfinished_rows,
       count(*) FILTER (WHERE rolled_back_at IS NOT NULL) AS rolled_back_rows,
       count(*) FILTER (WHERE finished_at IS NULL AND rolled_back_at IS NULL) = 0 AS pass
FROM "_prisma_migrations";
