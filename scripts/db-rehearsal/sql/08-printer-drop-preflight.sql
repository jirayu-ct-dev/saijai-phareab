-- Read-only, aggregate-only preflight for the Direct Print schema cutover.
-- Run against the exact production target only after read-only approval.

SELECT
  'printer_drop_inventory' AS check_id,
  to_regclass('public.printer') IS NOT NULL
    AND to_regclass('public.print_job') IS NOT NULL AS pass,
  CASE WHEN to_regclass('public.printer') IS NULL THEN 0 ELSE (SELECT count(*) FROM printer) END AS printer_rows,
  CASE WHEN to_regclass('public.print_job') IS NULL THEN 0 ELSE (SELECT count(*) FROM print_job) END AS print_job_rows,
  CASE WHEN to_regclass('public.printer') IS NULL THEN 0 ELSE pg_total_relation_size('printer') END AS printer_bytes,
  CASE WHEN to_regclass('public.print_job') IS NULL THEN 0 ELSE pg_total_relation_size('print_job') END AS print_job_bytes;

SELECT
  'printer_drop_in_flight' AS check_id,
  count(*) = 0 AS pass,
  count(*) AS violating_rows
FROM print_job
WHERE "deletedAt" IS NULL
  AND status IN ('QUEUED', 'CLAIMED', 'RENDERING', 'READY', 'SENDING', 'RETRY_WAIT', 'NEEDS_REVIEW');

SELECT
  'printer_drop_external_foreign_keys' AS check_id,
  count(*) = 0 AS pass,
  count(*) AS violating_rows
FROM pg_constraint c
WHERE c.contype = 'f'
  AND c.confrelid IN ('"printer"'::regclass, '"print_job"'::regclass)
  AND c.conrelid NOT IN ('"printer"'::regclass, '"print_job"'::regclass);

SELECT
  'printer_drop_dependent_views' AS check_id,
  count(*) = 0 AS pass,
  count(*) AS violating_rows
FROM pg_rewrite r
JOIN pg_class v ON v.oid = r.ev_class
JOIN pg_depend d ON d.objid = r.oid
WHERE v.relkind IN ('v', 'm')
  AND d.refobjid IN ('"printer"'::regclass, '"print_job"'::regclass);

SELECT
  'printer_drop_expected_types' AS check_id,
  count(*) = 5 AS pass,
  count(*) AS enum_count
FROM pg_type
WHERE typnamespace = 'public'::regnamespace
  AND typname IN ('PrinterModel', 'PrintTransport', 'PrintRenderMode', 'PrintDocumentKind', 'PrintJobStatus');
