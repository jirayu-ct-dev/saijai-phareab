-- 07-completion-timestamps.sql — checklist 8.7 (completion timestamp)
-- Aggregate-only. Safe inside a READ ONLY transaction. No PII in output.
--
-- Prisma maps this field as service_order."completedAt". It is introduced by
-- the Phase 2 expand migration (plan DB-03). This script is placeholder-ready:
-- it detects the column via the catalog and reports SKIPPED before DB-03,
-- then real invariant counts afterwards.
--
-- Invariants (plan C6 / F2 / F5):
--   * HARD: an order NOT in COMPLETED must never carry completedAt
--     (no fake timestamp from a bad transition).
--   * HARD (only when a cutover instant is supplied via
--     `SET rehearsal.completed_at_cutover`): orders created after the
--     cutover that reached COMPLETED must have completedAt — the transition
--     utility owns the stamp from the cutover onward.
--   * REPORT-ONLY: legacy COMPLETED orders keep completedAt = NULL
--     (never backfilled from updatedAt or paidAt, per F5). Counting them as
--     violations would false-fail every pre-existing completed order right
--     after the expand migration, so they are context, not a gate.
--
-- The cutover GUC is optional; the runner sets it from
-- REHEARSAL_COMPLETED_AT_CUTOVER (ISO-8601). Without it, only the
-- non-COMPLETED rule is enforced.

DO $rehearsal$
DECLARE
  v_column_present boolean;
  v_cutover_text text;
  v_cutover timestamptz;
  v_set_on_non_completed bigint;
  v_after_cutover_without_completed_at bigint;
  v_completed_total bigint;
  v_completed_with_completed_at bigint;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'service_order'
      AND column_name = 'completedAt'
  )
  INTO v_column_present;

  IF NOT v_column_present THEN
    RAISE NOTICE 'check_id=% value=% pass=%',
      'service_order_completed_at', 'SKIPPED_COLUMN_NOT_PRESENT', true;
    RETURN;
  END IF;

  v_cutover_text := current_setting('rehearsal.completed_at_cutover', true);
  IF v_cutover_text IS NOT NULL AND v_cutover_text <> '' THEN
    BEGIN
      v_cutover := v_cutover_text::timestamptz;
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'rehearsal.completed_at_cutover is not a valid timestamptz: %',
        v_cutover_text;
    END;
  END IF;

  SELECT count(*) INTO v_completed_total
  FROM "service_order" WHERE status = 'COMPLETED';

  SELECT count(*) INTO v_completed_with_completed_at
  FROM "service_order"
  WHERE status = 'COMPLETED' AND "completedAt" IS NOT NULL;

  -- HARD: timestamps outside COMPLETED are always wrong.
  SELECT count(*) INTO v_set_on_non_completed
  FROM "service_order"
  WHERE status <> 'COMPLETED' AND "completedAt" IS NOT NULL;
  RAISE NOTICE 'check_id=% value=% pass=%',
    'non_completed_orders_with_completed_at', v_set_on_non_completed,
    v_set_on_non_completed = 0;

  -- HARD, cutover-gated: post-cutover COMPLETED orders must be stamped.
  IF v_cutover IS NOT NULL THEN
    SELECT count(*) INTO v_after_cutover_without_completed_at
    FROM "service_order"
    WHERE status = 'COMPLETED'
      AND "createdAt" >= v_cutover
      AND "completedAt" IS NULL;
    RAISE NOTICE 'check_id=% value=% pass=%',
      'completed_orders_after_cutover_without_completed_at',
      v_after_cutover_without_completed_at,
      v_after_cutover_without_completed_at = 0;
  ELSE
    RAISE NOTICE 'check_id=% value=% pass=%',
      'completed_orders_after_cutover_without_completed_at',
      'SKIPPED_NO_CUTOVER', true;
  END IF;

  -- Report-only context (F5: legacy NULLs are expected and correct).
  RAISE NOTICE 'check_id=% value=% pass=%',
    'completed_orders_total', v_completed_total, true;
  RAISE NOTICE 'check_id=% value=% pass=%',
    'completed_orders_with_completed_at', v_completed_with_completed_at, true;
END
$rehearsal$;
