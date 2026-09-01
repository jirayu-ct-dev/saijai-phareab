-- 07-completion-timestamps.sql — checklist 8.7 (completion timestamp)
-- Aggregate-only. Safe inside a READ ONLY transaction. No PII in output.
--
-- service_order.completed_at does NOT exist yet — it is introduced by the
-- Phase 2 expand migration (plan DB-03). This script is placeholder-ready:
-- it detects the column via the catalog and reports SKIPPED before the
-- expand migration, then real invariant counts afterwards.
--
-- Target invariants (plan C6 / F2 / F5):
--   * new orders in COMPLETED must have completedAt
--   * orders not in COMPLETED must not carry a completedAt from a bad
--     transition
--   * legacy completed orders keep completedAt = NULL (never backfilled from
--     updatedAt or paidAt)

DO $rehearsal$
DECLARE
  v_column_present boolean;
  v_missing_on_completed bigint;
  v_set_on_non_completed bigint;
  v_completed_total bigint;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'service_order'
      AND column_name = 'completed_at'
  )
  INTO v_column_present;

  IF NOT v_column_present THEN
    RAISE NOTICE 'check_id=% value=% pass=%',
      'service_order_completed_at', 'SKIPPED_COLUMN_NOT_PRESENT', true;
    RETURN;
  END IF;

  SELECT count(*) INTO v_completed_total
  FROM "service_order" WHERE status = 'COMPLETED';

  SELECT count(*) INTO v_missing_on_completed
  FROM "service_order"
  WHERE status = 'COMPLETED' AND "completedAt" IS NULL;

  SELECT count(*) INTO v_set_on_non_completed
  FROM "service_order"
  WHERE status <> 'COMPLETED' AND "completedAt" IS NOT NULL;

  RAISE NOTICE 'check_id=% value=% pass=%',
    'completed_orders_without_completed_at', v_missing_on_completed,
    v_missing_on_completed = 0;
  RAISE NOTICE 'check_id=% value=% pass=%',
    'non_completed_orders_with_completed_at', v_set_on_non_completed,
    v_set_on_non_completed = 0;
  RAISE NOTICE 'check_id=% value=% pass=%',
    'completed_orders_total', v_completed_total, true;
END
$rehearsal$;
