-- 03-backfill-negative-overlay.sql — DB-05 fail-closed proof data.
--
-- Loaded ONLY by the backfill rehearsal, AFTER the idempotency cycle and the
-- dump/restore equality check. These rows are intentionally inconsistent so
-- the backfill must quarantine them (exit 2) or report a mismatch (exit 1)
-- without writing anything:
--
--   fxso6  parser-quarantine JSON entries -> invalid-json / unknown-shape
--   fxso7  parser-clean entries only, one entitlement missing
--          -> missing-entitlement; the order must get NO ledger rows at all
--             (order-level fail closed, kept separate from fxso6 so the
--             early parser quarantine cannot mask this branch)
--   business_setting.name populated and conflicting -> settings mismatch
--
-- Note: a "missing-image" photo quarantine cannot be produced by data —
-- service_order_item.imageId carries a real foreign key, so the database
-- itself fails closed on that path (covered instead by the unit tests).
--
-- The overlay rows stay coherent with the payment invariants (each order has
-- one UNPAID payment) so the add-on findings are attributable to the JSON
-- alone.

BEGIN;

INSERT INTO "service_order" (id, "orderNo", "customerId", "employeeId", status,
                             "subtotalAmount", "discountAmount", "totalAmount",
                             "receivedAt", "createdAt", "updatedAt")
VALUES ('fxso6', 'FX-ORD-0006', 'fxu_c2', 'fxu_emp', 'RECEIVED', 10.00, 0, 10.00,
        '2026-08-16 09:00:00', '2026-08-16 09:00:00', '2026-08-16 09:00:00'),
       ('fxso7', 'FX-ORD-0007', 'fxu_c2', 'fxu_emp', 'RECEIVED', 10.00, 0, 10.00,
        '2026-08-16 11:00:00', '2026-08-16 11:00:00', '2026-08-16 11:00:00');

INSERT INTO "payment_record" (id, "paymentNo", "userId", "serviceOrderId", amount, status,
                              "createdAt", "updatedAt")
VALUES ('fxpay8', 'FX-PAY-0008', 'fxu_c2', 'fxso6', 10.00, 'UNPAID',
        '2026-08-16 09:00:00', '2026-08-16 09:00:00'),
       ('fxpay9', 'FX-PAY-0009', 'fxu_c2', 'fxso7', 10.00, 'UNPAID',
        '2026-08-16 11:00:00', '2026-08-16 11:00:00');

UPDATE "service_order"
SET "addonUsages" = '[
      {"entitlementId":"fxent1","credits":2,"deductOn":"CREATED","refundedAt":"2026-08-16T10:00:00.000Z"},
      "not-an-object",
      {"entitlementId":"fxent1","credits":2,"deductOn":"CREATED","deductedAt":"2026-08-16T09:05:00.000Z"}
    ]'::jsonb
WHERE id = 'fxso6';

-- Parser-clean entries: the only defect is the missing entitlement, so the
-- runner must hit the order-level fail-closed branch, not the parser branch.
UPDATE "service_order"
SET "addonUsages" = '[
      {"entitlementId":"fxent1","credits":1,"deductOn":"CREATED","deductedAt":"2026-08-16T11:05:00.000Z"},
      {"entitlementId":"fxent_ghost","credits":2,"deductOn":"CREATED","deductedAt":"2026-08-16T11:06:00.000Z"}
    ]'::jsonb
WHERE id = 'fxso7';

-- Conflicting, already-populated target field: the backfill must report a
-- mismatch and never overwrite it.
UPDATE "business_setting" SET "name" = 'Conflicting Name' WHERE id = 'singleton';

COMMIT;
