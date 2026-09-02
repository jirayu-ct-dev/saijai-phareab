-- 02-violations-overlay.sql — NEGATIVE self-test overlay. NEVER load this
-- except into a disposable database, and only to prove that the preflight
-- runner with --enforce exits 3. Each insert breaks a hard invariant on
-- purpose; the overlay is invalid data by construction.

BEGIN;

-- Breaks: service_order_with_multiple_payments_ever (fxso2 gets a second
-- payment) AND paid_payment_missing_paid_at (PAID without paidAt).
INSERT INTO "payment_record" (id, "paymentNo", "userId", "serviceOrderId",
                              amount, status, method, "createdAt", "updatedAt")
VALUES ('fxpay_bad1', 'FX-PAY-BAD-1', 'fxu_c1', 'fxso2', 80.00, 'PAID', 'CASH',
        '2026-08-15 09:00:00', '2026-08-15 09:00:00');

-- Breaks: ledger_refunded_without_deducted (refund recorded without a
-- deduction) AND credits_json_vs_ledger_mismatched_pairs (JSON says 2,
-- ledger now says 2 + 9).
INSERT INTO "service_order_addon_usage" (id, "serviceOrderId", "memberEntitlementId", "productId",
                                         "productName", credits, "deductOn", "isDelivery",
                                         "refundedAt", "createdAt", "updatedAt")
VALUES ('fxau_bad1', 'fxso3', 'fxent1', 'fxprod_addon', 'Fixture Add-on', 9, 'CREATED', false,
        '2026-08-15 09:00:00', '2026-08-15 09:00:00', '2026-08-15 09:00:00');

-- Breaks: payment_source_zero (a payment with no source at all — the schema
-- CHECK payment_record_single_source blocks *multiple* sources, but not a
-- sourceless payment, which is exactly why the preflight check exists).
INSERT INTO "payment_record" (id, "paymentNo", "userId",
                              amount, status, "createdAt", "updatedAt")
VALUES ('fxpay_bad2', 'FX-PAY-BAD-2', 'fxu_c2', 10.00, 'UNPAID',
        '2026-08-15 09:00:00', '2026-08-15 09:00:00');

COMMIT;
