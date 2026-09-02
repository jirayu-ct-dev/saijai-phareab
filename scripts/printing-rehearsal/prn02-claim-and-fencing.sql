-- prn02-claim-and-fencing.sql — PRN-02 fencing + stale-lease re-claim checks.
--
-- Preconditions (created by prn02-seed-and-idempotency.sql):
--   printer  p_prn02_rehearsal
--   user     u_prn02_rehearsal
--   payment  pay_prn02_rehearsal
--   job      pj_prn02_claim_me in QUEUED (claimed by the concurrent-claim step,
--            or still QUEUED if run standalone)
--
-- Every assertion is a DO block that RAISEs on failure; run psql with
-- ON_ERROR_STOP=1.

-- =====================================================================
-- Test c — fencingToken increments monotonically via
--   UPDATE ... SET fencing_token = COALESCE(fencing_token, 0) + 1 RETURNING
-- (physical columns camelCase; fencingToken starts NULL).
-- =====================================================================

DO $$
DECLARE
  t1 INT;
  t2 INT;
BEGIN
  UPDATE "print_job"
  SET "fencingToken" = COALESCE("fencingToken", 0) + 1
  WHERE "id" = 'pj_prn02_claim_me'
  RETURNING "fencingToken" INTO t1;

  UPDATE "print_job"
  SET "fencingToken" = COALESCE("fencingToken", 0) + 1
  WHERE "id" = 'pj_prn02_claim_me'
  RETURNING "fencingToken" INTO t2;

  IF t1 IS DISTINCT FROM 1 OR t2 IS DISTINCT FROM 2 THEN
    RAISE EXCEPTION 'PRN02_FAIL: fencing token did not increment monotonically (got % then %)', t1, t2;
  END IF;
  RAISE NOTICE 'PRN02_OK: fencing token incremented % -> %', t1, t2;
END $$;

-- =====================================================================
-- Test d — stale lease re-claim: when lease_expires_at < now() and no
-- bytes were written (sendStartedAt IS NULL), the application layer puts
-- the job back to QUEUED and the claim query wins again with a NEW lease
-- token. Mirrors resolvePrintJobLeaseExpiry() RECLAIMABLE semantics.
-- =====================================================================

DO $$
DECLARE
  first_token  TEXT;
  second_token TEXT;
  reclaimed    INT;
BEGIN
  -- Make sure the job is claimed with a live lease first (idempotent).
  UPDATE "print_job"
  SET "status" = 'CLAIMED',
      "leaseToken" = 'lease-first',
      "leaseExpiresAt" = now() + interval '30 seconds',
      "attemptCount" = "attemptCount" + 1
  WHERE "id" = 'pj_prn02_claim_me'
    AND "id" IN (
      SELECT "id" FROM "print_job"
      WHERE "status" = 'QUEUED' AND "availableAt" <= now()
      ORDER BY "createdAt"
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    )
  RETURNING "leaseToken" INTO first_token;

  SELECT "leaseToken" INTO first_token FROM "print_job" WHERE "id" = 'pj_prn02_claim_me';
  IF first_token IS NULL THEN
    RAISE EXCEPTION 'PRN02_FAIL: expected an active lease before the stale test';
  END IF;

  -- The lease goes stale.
  UPDATE "print_job"
  SET "leaseExpiresAt" = now() - interval '1 second'
  WHERE "id" = 'pj_prn02_claim_me';

  -- Application-layer reclaim of an expired pre-send lease.
  UPDATE "print_job"
  SET "status" = 'QUEUED'
  WHERE "id" = 'pj_prn02_claim_me'
    AND "status" = 'CLAIMED'
    AND "leaseExpiresAt" < now()
    AND "sendStartedAt" IS NULL;
  GET DIAGNOSTICS reclaimed = ROW_COUNT;

  IF reclaimed <> 1 THEN
    RAISE EXCEPTION 'PRN02_FAIL: stale lease was not reclaimable (row count %)', reclaimed;
  END IF;

  -- The claim query must now win again and mint a NEW lease token.
  UPDATE "print_job"
  SET "status" = 'CLAIMED',
      "leaseToken" = 'lease-second',
      "leaseExpiresAt" = now() + interval '30 seconds',
      "attemptCount" = "attemptCount" + 1
  WHERE "id" = 'pj_prn02_claim_me'
    AND "id" IN (
      SELECT "id" FROM "print_job"
      WHERE "status" = 'QUEUED' AND "availableAt" <= now()
      ORDER BY "createdAt"
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    )
  RETURNING "leaseToken" INTO second_token;

  IF second_token IS NULL THEN
    RAISE EXCEPTION 'PRN02_FAIL: claim query did not win after stale-lease reclaim';
  END IF;
  IF second_token = first_token THEN
    RAISE EXCEPTION 'PRN02_FAIL: re-claim reused the stale lease token %', first_token;
  END IF;
  RAISE NOTICE 'PRN02_OK: stale lease reclaimed, new lease token % (was %)', second_token, first_token;
END $$;

-- A claim against an actively-leased (non-QUEUED) job must return nothing.
DO $$
DECLARE
  stolen INT;
BEGIN
  WITH claim AS (
    UPDATE "print_job"
    SET "status" = 'CLAIMED'
    WHERE "id" IN (
      SELECT "id" FROM "print_job"
      WHERE "status" = 'QUEUED' AND "availableAt" <= now()
      ORDER BY "createdAt"
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    )
    RETURNING 1
  )
  SELECT count(*) INTO stolen FROM claim;

  IF stolen <> 0 THEN
    RAISE EXCEPTION 'PRN02_FAIL: claim query stole an actively-leased job';
  END IF;
  RAISE NOTICE 'PRN02_OK: actively leased job is not claimable';
END $$;
