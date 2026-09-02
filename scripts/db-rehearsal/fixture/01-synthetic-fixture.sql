-- 01-synthetic-fixture.sql — dedicated synthetic, non-PII fixture for the
-- disposable migration rehearsal. Loaded AFTER a full `prisma migrate deploy`
-- replay. Every row is fake ("Fixture …", example.test emails, fx* ids) and
-- must satisfy every hard preflight invariant:
--
--   * exactly one payment per source, one source per payment, amounts equal
--   * every active source has an active payment (and vice versa)
--   * PAID payments carry paidAt/confirmedAt/receiptNo
--   * PackageSale.status matches the payment status mapping
--   * add-on ledger row credits == legacy JSON credits (pair fxso3/fxent1)
--   * no ledger refund without deduction; no dangling references
--   * settings singletons intact; subscribers follow the active-staff policy
--   * the direct image id has an image row AND an active join row
--   * fxso1 is a legacy COMPLETED order: completedAt stays NULL (F5) once the
--     DB-03 expand migration introduces the column
--
-- Aggregate-only tools read this data; no PII column exists by construction.
-- Insert order respects foreign keys.

BEGIN;

-- ===== users (synthetic, non-PII) =====
INSERT INTO "user" (id, email, name, "emailVerified", role, "customerAccountStatus",
                    "lineNotifyEnabled", "isActive", "createdAt", "updatedAt")
VALUES
  ('fxu_admin', 'fixture-admin@example.test', 'Fixture Admin', true, 'ADMIN', 'ACTIVE', false, true, '2026-07-01 08:00:00', '2026-07-01 08:00:00'),
  ('fxu_emp',  'fixture-staff@example.test',  'Fixture Staff', true, 'EMPLOYEE', 'ACTIVE', false, true, '2026-07-01 08:00:00', '2026-07-01 08:00:00'),
  ('fxu_c1',   'fixture-cust1@example.test',  'Fixture Customer One', true, 'USER', 'ACTIVE', true, true, '2026-07-02 08:00:00', '2026-07-02 08:00:00'),
  ('fxu_c2',   'fixture-cust2@example.test',  'Fixture Customer Two', false, 'USER', 'OFFLINE', true, true, '2026-07-02 08:00:00', '2026-07-02 08:00:00');

-- ===== settings singletons =====
INSERT INTO "shop_setting" (id, name, phone, address, "updatedAt")
VALUES ('singleton', 'Fixture Laundry', '029999999', 'Fixture Address', '2026-07-01 08:00:00');

INSERT INTO "business_setting" (id, "hangerPricePerUnit", "washFoldPricePerKg", "washFoldMinKg",
                                "vatRate", "vatIncluded", "paymentNoPrefix", "orderNoPrefix",
                                "quotationNoPrefix", "receiptNoPrefix", "minimumOrderAmount",
                                "packageRefundDays", "updatedAt")
VALUES ('singleton', 10, 60, 0, 0, false, 'PAY-', 'ORD-', 'QT-', 'RC-', 0, 7, '2026-07-01 08:00:00');

INSERT INTO "notification_setting" (id, "updatedAt")
VALUES ('singleton', '2026-07-01 08:00:00');

-- ===== storefront catalog =====
INSERT INTO "storefront_category" (id, name, "isActive", "createdAt", "updatedAt")
VALUES ('fxc_cat1', 'Fixture Category', true, '2026-07-01 08:00:00', '2026-07-01 08:00:00');

INSERT INTO "storefront_service" (id, name, "isActive", "createdAt", "updatedAt")
VALUES
  ('fxsvc_wash', 'Fixture Wash & Fold', true, '2026-07-01 08:00:00', '2026-07-01 08:00:00'),
  ('fxsvc_dry',  'Fixture Dry Clean',   true, '2026-07-01 08:00:00', '2026-07-01 08:00:00');

INSERT INTO "storefront_item" (id, name, "categoryId", "isActive", "createdAt", "updatedAt")
VALUES
  ('fxitem_shirt', 'Fixture Shirt', 'fxc_cat1', true, '2026-07-01 08:00:00', '2026-07-01 08:00:00'),
  ('fxitem_pants', 'Fixture Pants', 'fxc_cat1', true, '2026-07-01 08:00:00', '2026-07-01 08:00:00');

INSERT INTO "storefront_price" (id, "storefrontServiceId", "storefrontItemId", price, "isActive", "createdAt", "updatedAt")
VALUES
  ('fxprice1', 'fxsvc_wash', 'fxitem_shirt', 125.00, true, '2026-07-01 08:00:00', '2026-07-01 08:00:00'),
  ('fxprice2', 'fxsvc_dry',  'fxitem_pants', 80.00,  true, '2026-07-01 08:00:00', '2026-07-01 08:00:00');

-- ===== package products =====
INSERT INTO "package_product" (id, name, "packageType", "isDelivery", "deductOn", price, credits,
                               "validityDays", "isActive", "createdAt", "updatedAt")
VALUES
  ('fxprod_main',  'Fixture Main Package',  'MAIN',  false, 'CREATED', 500.00, 10, 365, true, '2026-07-01 08:00:00', '2026-07-01 08:00:00'),
  ('fxprod_addon', 'Fixture Add-on',        'ADDON', false, 'CREATED', 50.00,  1,  NULL, true, '2026-07-01 08:00:00', '2026-07-01 08:00:00');

-- ===== image (referenced by direct id AND active join row) =====
INSERT INTO "image" (id, "userId", "publicId", url, "secureUrl", "createdAt", "updatedAt")
VALUES ('fximg1', 'fxu_c1', 'fixture/img-1', 'https://fixture.example.test/img-1', 'https://fixture.example.test/img-1-secure', '2026-08-01 08:00:00', '2026-08-01 08:00:00');

-- ===== package sales =====
INSERT INTO "package_sale" (id, "customerId", "soldById", status, "subtotalAmount", "discountAmount",
                            "totalAmount", "createdAt", "updatedAt")
VALUES
  ('fxps1', 'fxu_c1', 'fxu_admin', 'PAID',   500.00, 0, 500.00, '2026-07-20 09:00:00', '2026-07-20 09:05:00'),
  ('fxps2', 'fxu_c2', 'fxu_admin', 'PENDING', 250.00, 0, 250.00, '2026-08-10 09:00:00', '2026-08-10 09:00:00');

INSERT INTO "package_sale_item" (id, "packageSaleId", "productId", "itemType", qty, "unitPrice", "totalPrice", "createdAt", "updatedAt")
VALUES
  ('fxpsi1', 'fxps1', 'fxprod_main',  'MAIN', 1, 500.00, 500.00, '2026-07-20 09:00:00', '2026-07-20 09:00:00'),
  ('fxpsi2', 'fxps2', 'fxprod_addon', 'ADDON', 5, 50.00, 250.00, '2026-08-10 09:00:00', '2026-08-10 09:00:00');

INSERT INTO "member_entitlement" (id, "customerId", "sourceSaleItemId", "productId", status,
                                  "creditInitial", "creditRemaining", "startAt", "endAt",
                                  "activatedAt", "createdAt", "updatedAt")
VALUES ('fxent1', 'fxu_c1', 'fxpsi1', 'fxprod_main', 'ACTIVE', 10, 8,
        '2026-07-20 09:05:00', '2027-07-20 09:05:00', '2026-07-20 09:05:00',
        '2026-07-20 09:05:00', '2026-07-20 09:05:00');

-- ===== service orders =====
INSERT INTO "service_order" (id, "orderNo", "quotationNo", "customerId", "employeeId", status,
                             "subtotalAmount", "discountAmount", "totalAmount",
                             "receivedAt", "createdAt", "updatedAt")
VALUES
  ('fxso1', 'FX-ORD-0001', NULL, 'fxu_c1', 'fxu_emp', 'COMPLETED', 250.00, 0, 250.00,
   '2026-08-01 09:00:00', '2026-08-01 09:00:00', '2026-08-02 10:00:00'),
  ('fxso2', NULL, 'FX-QT-0002', 'fxu_c1', 'fxu_emp', 'RECEIVED', 80.00, 0, 80.00,
   '2026-08-11 09:00:00', '2026-08-11 09:00:00', '2026-08-11 09:00:00'),
  ('fxso3', 'FX-ORD-0003', NULL, 'fxu_c1', 'fxu_emp', 'PROCESSING', 30.00, 0, 30.00,
   '2026-08-12 09:00:00', '2026-08-12 09:00:00', '2026-08-12 09:30:00'),
  ('fxso4', NULL, NULL, 'fxu_c2', NULL, 'RECEIVED', 15.00, 0, NULL,
   '2026-08-13 09:00:00', '2026-08-13 09:00:00', '2026-08-14 09:00:00'),
  -- DB-05 add-on backfill target: legacy JSON only, no normalized rows yet.
  ('fxso5', 'FX-ORD-0005', NULL, 'fxu_c1', 'fxu_emp', 'RECEIVED', 25.00, 0, 25.00,
   '2026-08-15 09:00:00', '2026-08-15 09:00:00', '2026-08-15 09:00:00');

UPDATE "service_order" SET "deletedAt" = '2026-08-14 09:00:00', "deletedById" = 'fxu_admin'
WHERE id = 'fxso4';

INSERT INTO "service_order_item" (id, "serviceOrderId", "storefrontPriceId", "weightKg", "weightLabel",
                                  "isPackageIncluded", quantity, "unitPrice", "totalPrice",
                                  "imageId", "createdAt", "updatedAt")
VALUES
  ('fxsoi1', 'fxso1', 'fxprice1', 2.0, '2 kg', false, 2, 125.00, 250.00, 'fximg1',
   '2026-08-01 09:00:00', '2026-08-01 09:00:00'),
  ('fxsoi2', 'fxso2', 'fxprice2', NULL, NULL, false, 1, 80.00, 80.00, NULL,
   '2026-08-11 09:00:00', '2026-08-11 09:00:00'),
  ('fxsoi3', 'fxso3', 'fxprice1', 0.5, '0.5 kg', false, 1, 30.00, 30.00, NULL,
   '2026-08-12 09:00:00', '2026-08-12 09:00:00'),
  -- DB-05 photo backfill target: direct imageId without a join row.
  ('fxsoi4', 'fxso2', 'fxprice2', NULL, NULL, false, 1, 80.00, 80.00, 'fximg1',
   '2026-08-11 09:00:00', '2026-08-11 09:00:00');

INSERT INTO "service_order_item_image" (id, "serviceOrderItemId", "imageId", "isDamaged", "sortOrder",
                                        "createdAt", "updatedAt")
VALUES ('fxsoii1', 'fxsoi1', 'fximg1', false, 0, '2026-08-01 09:00:00', '2026-08-01 09:00:00');

-- Add-on ledger row + matching legacy JSON (credits 2 == 2).
INSERT INTO "service_order_addon_usage" (id, "serviceOrderId", "memberEntitlementId", "productId",
                                         "productName", credits, "deductOn", "isDelivery",
                                         "deductedAt", "refundedAt", "createdAt", "updatedAt")
VALUES ('fxau1', 'fxso3', 'fxent1', 'fxprod_addon', 'Fixture Add-on', 2, 'CREATED', false,
        '2026-08-12 09:30:00', NULL, '2026-08-12 09:00:00', '2026-08-12 09:30:00');

UPDATE "service_order"
SET "memberEntitlementId" = 'fxent1',
    "creditUsed" = 2,
    "addonUsages" = '[{"entitlementId":"fxent1","productId":"fxprod_addon","productName":"Fixture Add-on","credits":2,"deductOn":"CREATED","appliedAt":"2026-08-12T09:00:00.000Z","deductedAt":"2026-08-12T09:30:00.000Z"}]'::jsonb
WHERE id = 'fxso3';

-- DB-05 add-on backfill target: one deducted usage plus one historically
-- refunded usage (both with deductions), no normalized rows yet.
UPDATE "service_order"
SET "memberEntitlementId" = 'fxent1',
    "creditUsed" = 1,
    "addonUsages" = '[
      {"entitlementId":"fxent1","productId":"fxprod_addon","productName":"Fixture Add-on","credits":1,"deductOn":"CREATED","appliedAt":"2026-08-15T09:00:00.000Z","deductedAt":"2026-08-15T09:00:00.000Z"},
      {"entitlementId":"fxent1","credits":1,"deductOn":"COMPLETED","deductedAt":"2026-08-15T09:10:00.000Z","refundedAt":"2026-08-15T10:00:00.000Z"}
    ]'::jsonb
WHERE id = 'fxso5';

-- ===== payments (one per source, one source each, amounts exact) =====
INSERT INTO "payment_record" (id, "paymentNo", "receiptNo", "userId", "packageSaleId", "serviceOrderId",
                              amount, status, method, "paidAt", "confirmedAt", "confirmedById",
                              "createdAt", "updatedAt")
VALUES
  -- PAID package sale
  ('fxpay1', 'FX-PAY-0001', 'FX-RC-0001', 'fxu_c1', 'fxps1', NULL, 500.00, 'PAID', 'CASH',
   '2026-07-20 09:05:00', '2026-07-20 09:05:00', 'fxu_admin', '2026-07-20 09:00:00', '2026-07-20 09:05:00'),
  -- PAID completed order (legacy: completedAt will stay NULL after DB-03)
  ('fxpay2', 'FX-PAY-0002', 'FX-RC-0002', 'fxu_c1', NULL, 'fxso1', 250.00, 'PAID', 'CASH',
   '2026-08-02 10:00:00', '2026-08-02 10:00:00', 'fxu_admin', '2026-08-01 09:00:00', '2026-08-02 10:00:00'),
  -- UNPAID quotation-stage order
  ('fxpay3', 'FX-PAY-0003', NULL, 'fxu_c1', NULL, 'fxso2', 80.00, 'UNPAID', NULL,
   NULL, NULL, NULL, '2026-08-11 09:00:00', '2026-08-11 09:00:00'),
  -- UNPAID in-progress order paid with credits + money
  ('fxpay4', 'FX-PAY-0004', NULL, 'fxu_c1', NULL, 'fxso3', 30.00, 'UNPAID', NULL,
   NULL, NULL, NULL, '2026-08-12 09:00:00', '2026-08-12 09:00:00'),
  -- UNPAID pending package sale
  ('fxpay5', 'FX-PAY-0005', NULL, 'fxu_c2', 'fxps2', NULL, 250.00, 'UNPAID', NULL,
   NULL, NULL, NULL, '2026-08-10 09:00:00', '2026-08-10 09:00:00'),
  -- soft-deleted payment on a soft-deleted order (delete-state symmetry)
  ('fxpay6', 'FX-PAY-0006', NULL, 'fxu_c2', NULL, 'fxso4', 15.00, 'UNPAID', NULL,
   NULL, NULL, NULL, '2026-08-13 09:00:00', '2026-08-13 09:00:00'),
  -- UNPAID add-on backfill target order
  ('fxpay7', 'FX-PAY-0007', NULL, 'fxu_c1', NULL, 'fxso5', 25.00, 'UNPAID', NULL,
   NULL, NULL, NULL, '2026-08-15 09:00:00', '2026-08-15 09:00:00');

UPDATE "payment_record" SET "deletedAt" = '2026-08-14 09:00:00', "deletedById" = 'fxu_admin'
WHERE id = 'fxpay6';

INSERT INTO "payment_audit_log" (id, "paymentId", action, "actorId", "createdAt")
VALUES
  ('fxpal1', 'fxpay1', 'CONFIRMED', 'fxu_admin', '2026-07-20 09:05:00'),
  ('fxpal2', 'fxpay2', 'CONFIRMED', 'fxu_admin', '2026-08-02 10:00:00');

-- ===== notification subscribers (active staff + inactive customer) =====
INSERT INTO "notification_subscriber" (id, "userId", "isActive", "receiveNewOrder",
                                       "receiveStatusChange", "receiveReceipt", "createdAt", "updatedAt")
VALUES
  ('fxsub1', 'fxu_admin', true, true, true, true, '2026-07-01 08:00:00', '2026-07-01 08:00:00'),
  ('fxsub2', 'fxu_emp', true, true, true, true, '2026-07-01 08:00:00', '2026-07-01 08:00:00'),
  ('fxsub3', 'fxu_c1', false, true, true, true, '2026-07-02 08:00:00', '2026-07-03 08:00:00');

-- ===== expenses =====
INSERT INTO "expense_category" (id, name, "normalizedName", "isActive", "createdAt", "updatedAt")
VALUES ('fxexpcat1', 'Fixture Supplies', 'fixture supplies', true, '2026-07-01 08:00:00', '2026-07-01 08:00:00');

INSERT INTO "expense" (id, "categoryId", amount, "expenseAt", description, "createdById", "createdAt", "updatedAt")
VALUES ('fxexp1', 'fxexpcat1', 120.50, '2026-08-05 14:00:00', 'Fixture detergent restock', 'fxu_admin',
        '2026-08-05 14:00:00', '2026-08-05 14:00:00');

COMMIT;
