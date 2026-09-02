-- prn02-constraints.sql — PRN-02 constraint rehearsal (plan C7–C9, task PRN-02).
--
-- Runs against a disposable database created by run-prn02-constraints.sh after
-- a fresh `prisma migrate deploy` replay. Every assertion is a DO block that
-- RAISEs on failure; run psql with ON_ERROR_STOP=1 so any failure aborts.
--
-- Physical columns are camelCase (Prisma maps only table names), hence the
-- quoted identifiers. No endpoints, IPs or credentials appear in this file;
-- all values are synthetic rehearsal fixtures.

-- =====================================================================
-- Seed: minimal FK fixtures (user, printer, payment_record) + 1 job
-- =====================================================================

INSERT INTO "user" ("id", "email", "name", "updatedAt")
VALUES ('u_prn02_rehearsal', 'prn02-rehearsal@example.invalid', 'PRN-02 Rehearsal', now())
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "printer" ("id", "name", "defaultTransport", "paperWidthMm", "printableDots", "updatedAt")
VALUES ('p_prn02_rehearsal', 'Rehearsal XP-C260M', 'WIFI', 80, 576, now())
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "payment_record" ("id", "userId", "amount", "status", "updatedAt")
VALUES ('pay_prn02_rehearsal', 'u_prn02_rehearsal', 123.45, 'UNPAID', now())
ON CONFLICT ("id") DO NOTHING;

-- =====================================================================
-- Test b — idempotency: the print_job_idempotency_scope unique index
-- rejects a duplicate (requestedById, kind, documentId, selectedTransport,
-- idempotencyKey) scope but accepts a different scope.
-- =====================================================================

INSERT INTO "print_job" (
  "id", "printerId", "kind", "documentId", "documentNo", "documentRevision",
  "sourcePaymentId", "sourceStatus", "sourceRevision", "amountMinor",
  "snapshotHasPaymentQr", "snapshot", "snapshotHash", "renderVersion",
  "requestedById", "selectedTransport", "idempotencyKey", "timeline", "updatedAt"
) VALUES (
  'pj_prn02_scope_a', 'p_prn02_rehearsal', 'QUOTATION', 'pay_prn02_rehearsal', 'QT-REH-0001', 1,
  'pay_prn02_rehearsal', 'UNPAID', 1, 12345,
  true, '{"kind":"QUOTATION"}'::jsonb, 'sha256-rehearsal-a', 'render-v1',
  'u_prn02_rehearsal', 'WIFI', 'req-rehearsal-1', '[]'::jsonb, now()
);

DO $$
BEGIN
  BEGIN
    INSERT INTO "print_job" (
      "id", "printerId", "kind", "documentId", "documentNo", "documentRevision",
      "sourcePaymentId", "sourceStatus", "sourceRevision", "amountMinor",
      "snapshotHasPaymentQr", "snapshot", "snapshotHash", "renderVersion",
      "requestedById", "selectedTransport", "idempotencyKey", "timeline", "updatedAt"
    ) VALUES (
      'pj_prn02_scope_a_dup', 'p_prn02_rehearsal', 'QUOTATION', 'pay_prn02_rehearsal', 'QT-REH-0001', 1,
      'pay_prn02_rehearsal', 'UNPAID', 1, 12345,
      true, '{"kind":"QUOTATION"}'::jsonb, 'sha256-rehearsal-a', 'render-v1',
      'u_prn02_rehearsal', 'WIFI', 'req-rehearsal-1', '[]'::jsonb, now()
    );
    RAISE EXCEPTION 'PRN02_FAIL: duplicate idempotency scope was accepted (print_job_idempotency_scope missing?)';
  EXCEPTION
    WHEN unique_violation THEN
      RAISE NOTICE 'PRN02_OK: duplicate idempotency scope rejected (23505)';
  END;

  -- A different requestId within the same document/transport must be accepted.
  INSERT INTO "print_job" (
    "id", "printerId", "kind", "documentId", "documentNo", "documentRevision",
    "sourcePaymentId", "sourceStatus", "sourceRevision", "amountMinor",
    "snapshotHasPaymentQr", "snapshot", "snapshotHash", "renderVersion",
    "requestedById", "selectedTransport", "idempotencyKey", "timeline", "updatedAt"
  ) VALUES (
    'pj_prn02_scope_b', 'p_prn02_rehearsal', 'QUOTATION', 'pay_prn02_rehearsal', 'QT-REH-0001', 1,
    'pay_prn02_rehearsal', 'UNPAID', 1, 12345,
    true, '{"kind":"QUOTATION"}'::jsonb, 'sha256-rehearsal-a', 'render-v1',
    'u_prn02_rehearsal', 'WIFI', 'req-rehearsal-2', '[]'::jsonb, now()
  );
  RAISE NOTICE 'PRN02_OK: distinct scope accepted';
END $$;

-- Clean the scope-a/-b rows so the claim test starts from a single QUEUED job.
DELETE FROM "print_job" WHERE "id" IN ('pj_prn02_scope_a', 'pj_prn02_scope_b');

-- =====================================================================
-- Test a setup — exactly one QUEUED job for the concurrent-claim test,
-- which run-prn02-constraints.sh drives from two parallel psql sessions.
-- =====================================================================

INSERT INTO "print_job" (
  "id", "printerId", "kind", "documentId", "documentNo", "documentRevision",
  "sourcePaymentId", "sourceStatus", "sourceRevision", "amountMinor",
  "snapshotHasPaymentQr", "snapshot", "snapshotHash", "renderVersion",
  "requestedById", "selectedTransport", "idempotencyKey", "timeline", "updatedAt"
) VALUES (
  'pj_prn02_claim_me', 'p_prn02_rehearsal', 'RECEIPT', 'pay_prn02_rehearsal', 'RC-REH-0001', 1,
  'pay_prn02_rehearsal', 'UNPAID', 1, 12345,
  false, '{"kind":"RECEIPT"}'::jsonb, 'sha256-rehearsal-c', 'render-v1',
  'u_prn02_rehearsal', 'WIFI', 'req-rehearsal-3', '[]'::jsonb, now()
);
