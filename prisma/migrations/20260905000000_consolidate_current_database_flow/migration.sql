-- Consolidate the compatibility schema into the application's current source
-- of truth. This migration is intentionally fail-closed: every destructive
-- step is preceded by an invariant check, and the whole migration runs in the
-- explicit transaction below.

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "business_setting") AND (
    (SELECT count(*) FROM "business_setting") <> 1 OR
    NOT EXISTS (SELECT 1 FROM "business_setting" WHERE "id" = 'singleton')
  ) THEN
    RAISE EXCEPTION 'database consolidation blocked: business_setting is not a single singleton row';
  END IF;

  IF EXISTS (SELECT 1 FROM "shop_setting") AND (
    (SELECT count(*) FROM "shop_setting") <> 1 OR
    NOT EXISTS (SELECT 1 FROM "shop_setting" WHERE "id" = 'singleton')
  ) THEN
    RAISE EXCEPTION 'database consolidation blocked: shop_setting is not a single singleton row';
  END IF;

  IF EXISTS (SELECT 1 FROM "notification_setting") AND (
    (SELECT count(*) FROM "notification_setting") <> 1 OR
    NOT EXISTS (SELECT 1 FROM "notification_setting" WHERE "id" = 'singleton')
  ) THEN
    RAISE EXCEPTION 'database consolidation blocked: notification_setting is not a single singleton row';
  END IF;

  IF (
    EXISTS (SELECT 1 FROM "shop_setting" WHERE "id" = 'singleton') OR
    EXISTS (SELECT 1 FROM "notification_setting" WHERE "id" = 'singleton')
  ) AND NOT EXISTS (SELECT 1 FROM "business_setting" WHERE "id" = 'singleton') THEN
    RAISE EXCEPTION 'database consolidation blocked: legacy settings exist without business_setting.singleton';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "business_setting"
    WHERE
        "name" IS NULL OR "phone" IS NULL OR "address" IS NULL OR
        "lineQrEnabled" IS NULL OR
        "notifyCustomerOnQuotation" IS NULL OR
        "notifyCustomerOnReceived" IS NULL OR
        "notifyCustomerOnProcessing" IS NULL OR
        "notifyCustomerOnDelivering" IS NULL OR
        "notifyCustomerOnCompleted" IS NULL OR
        "notifyCustomerOnCancelled" IS NULL OR
        "notifyCustomerReceipt" IS NULL OR
        "notifyStaffOnNewOrder" IS NULL OR
        "notifyCustomerOnPackageExpiring" IS NULL
  ) THEN
    RAISE EXCEPTION 'database consolidation blocked: AppSetting backfill is incomplete';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "shop_setting" legacy
    JOIN "business_setting" target ON target."id" = legacy."id"
    WHERE legacy."name" IS DISTINCT FROM target."name"
       OR legacy."phone" IS DISTINCT FROM target."phone"
       OR legacy."address" IS DISTINCT FROM target."address"
       OR legacy."logoUrl" IS DISTINCT FROM target."logoUrl"
       OR legacy."lineQrImageUrl" IS DISTINCT FROM target."lineQrImageUrl"
  ) THEN
    RAISE EXCEPTION 'database consolidation blocked: shop settings do not match AppSetting';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "notification_setting" legacy
    JOIN "business_setting" target ON target."id" = legacy."id"
    WHERE legacy."notifyCustomerOnQuotation" IS DISTINCT FROM target."notifyCustomerOnQuotation"
       OR legacy."notifyCustomerOnReceived" IS DISTINCT FROM target."notifyCustomerOnReceived"
       OR legacy."notifyCustomerOnProcessing" IS DISTINCT FROM target."notifyCustomerOnProcessing"
       OR legacy."notifyCustomerOnDelivering" IS DISTINCT FROM target."notifyCustomerOnDelivering"
       OR legacy."notifyCustomerOnCompleted" IS DISTINCT FROM target."notifyCustomerOnCompleted"
       OR legacy."notifyCustomerOnCancelled" IS DISTINCT FROM target."notifyCustomerOnCancelled"
       OR legacy."notifyCustomerReceipt" IS DISTINCT FROM target."notifyCustomerReceipt"
       OR legacy."notifyStaffOnNewOrder" IS DISTINCT FROM target."notifyStaffOnNewOrder"
       OR legacy."notifyCustomerOnPackageExpiring" IS DISTINCT FROM target."notifyCustomerOnPackageExpiring"
  ) THEN
    RAISE EXCEPTION 'database consolidation blocked: notification settings do not match AppSetting';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "service_order" order_row
    WHERE jsonb_typeof(order_row."addonUsages") = 'array'
      AND jsonb_array_length(order_row."addonUsages") > 0
      AND NOT EXISTS (
        SELECT 1 FROM "service_order_addon_usage" usage
        WHERE usage."serviceOrderId" = order_row."id"
      )
  ) THEN
    RAISE EXCEPTION 'database consolidation blocked: add-on JSON exists without normalized ledger rows';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "service_order_item" item
    WHERE item."imageId" IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM "service_order_item_image" photo
        WHERE photo."serviceOrderItemId" = item."id"
          AND photo."imageId" = item."imageId"
          AND photo."deletedAt" IS NULL
      )
  ) THEN
    RAISE EXCEPTION 'database consolidation blocked: direct item image is missing from normalized photos';
  END IF;

  IF EXISTS (
    SELECT 1 FROM "payment_record"
    WHERE ("packageSaleId" IS NULL) = ("serviceOrderId" IS NULL)
  ) THEN
    RAISE EXCEPTION 'database consolidation blocked: every payment must have exactly one source';
  END IF;

  IF EXISTS (
    SELECT 1 FROM "payment_record"
    WHERE "packageSaleId" IS NOT NULL
    GROUP BY "packageSaleId" HAVING count(*) > 1
  ) OR EXISTS (
    SELECT 1 FROM "payment_record"
    WHERE "serviceOrderId" IS NOT NULL
    GROUP BY "serviceOrderId" HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'database consolidation blocked: a source has more than one payment';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "package_sale" sale
    LEFT JOIN "payment_record" payment ON payment."packageSaleId" = sale."id"
    WHERE payment."id" IS NULL
       OR sale."customerId" IS DISTINCT FROM payment."userId"
       OR sale."totalAmount" IS DISTINCT FROM payment."amount"
  ) OR EXISTS (
    SELECT 1
    FROM "service_order" order_row
    LEFT JOIN "payment_record" payment ON payment."serviceOrderId" = order_row."id"
    WHERE payment."id" IS NULL
       OR order_row."customerId" IS DISTINCT FROM payment."userId"
       OR (
         order_row."totalAmount" IS NOT NULL
         AND order_row."totalAmount" IS DISTINCT FROM payment."amount"
       )
  ) THEN
    RAISE EXCEPTION 'database consolidation blocked: payment source ownership or amount does not reconcile';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "payment_record" payment
    WHERE payment."memberEntitlementId" IS NOT NULL
      AND NOT (
        EXISTS (
          SELECT 1 FROM "service_order" order_row
          WHERE order_row."id" = payment."serviceOrderId"
            AND order_row."memberEntitlementId" = payment."memberEntitlementId"
        )
        OR EXISTS (
          SELECT 1
          FROM "package_sale_item" sale_item
          JOIN "member_entitlement" entitlement ON entitlement."sourceSaleItemId" = sale_item."id"
          WHERE sale_item."packageSaleId" = payment."packageSaleId"
            AND entitlement."id" = payment."memberEntitlementId"
        )
      )
  ) THEN
    RAISE EXCEPTION 'database consolidation blocked: payment entitlement cannot be derived from its source';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "package_sale" sale
    JOIN "payment_record" payment ON payment."packageSaleId" = sale."id"
    WHERE sale."status"::text IS DISTINCT FROM CASE payment."status"::text
      WHEN 'PAID' THEN 'PAID'
      WHEN 'CANCELLED' THEN 'CANCELLED'
      ELSE 'PENDING'
    END
  ) THEN
    RAISE EXCEPTION 'database consolidation blocked: package sale status differs from payment status';
  END IF;
END $$;

ALTER TABLE "business_setting"
  ALTER COLUMN "name" SET DEFAULT '',
  ALTER COLUMN "name" SET NOT NULL,
  ALTER COLUMN "phone" SET DEFAULT '',
  ALTER COLUMN "phone" SET NOT NULL,
  ALTER COLUMN "address" SET DEFAULT '',
  ALTER COLUMN "address" SET NOT NULL,
  ALTER COLUMN "lineQrEnabled" SET DEFAULT false,
  ALTER COLUMN "lineQrEnabled" SET NOT NULL,
  ALTER COLUMN "notifyCustomerOnQuotation" SET DEFAULT true,
  ALTER COLUMN "notifyCustomerOnQuotation" SET NOT NULL,
  ALTER COLUMN "notifyCustomerOnReceived" SET DEFAULT true,
  ALTER COLUMN "notifyCustomerOnReceived" SET NOT NULL,
  ALTER COLUMN "notifyCustomerOnProcessing" SET DEFAULT true,
  ALTER COLUMN "notifyCustomerOnProcessing" SET NOT NULL,
  ALTER COLUMN "notifyCustomerOnDelivering" SET DEFAULT true,
  ALTER COLUMN "notifyCustomerOnDelivering" SET NOT NULL,
  ALTER COLUMN "notifyCustomerOnCompleted" SET DEFAULT true,
  ALTER COLUMN "notifyCustomerOnCompleted" SET NOT NULL,
  ALTER COLUMN "notifyCustomerOnCancelled" SET DEFAULT true,
  ALTER COLUMN "notifyCustomerOnCancelled" SET NOT NULL,
  ALTER COLUMN "notifyCustomerReceipt" SET DEFAULT true,
  ALTER COLUMN "notifyCustomerReceipt" SET NOT NULL,
  ALTER COLUMN "notifyStaffOnNewOrder" SET DEFAULT true,
  ALTER COLUMN "notifyStaffOnNewOrder" SET NOT NULL,
  ALTER COLUMN "notifyCustomerOnPackageExpiring" SET DEFAULT true,
  ALTER COLUMN "notifyCustomerOnPackageExpiring" SET NOT NULL;

ALTER TABLE "payment_record" DROP CONSTRAINT "payment_record_single_source";
ALTER TABLE "payment_record" ADD CONSTRAINT "payment_record_source_exactly_one_check"
  CHECK (("packageSaleId" IS NOT NULL) <> ("serviceOrderId" IS NOT NULL));

CREATE UNIQUE INDEX "payment_record_packageSaleId_key" ON "payment_record"("packageSaleId");
CREATE UNIQUE INDEX "payment_record_serviceOrderId_key" ON "payment_record"("serviceOrderId");

ALTER TABLE "service_order_item" DROP CONSTRAINT "service_order_item_imageId_fkey";
ALTER TABLE "payment_record" DROP CONSTRAINT "payment_record_memberEntitlementId_fkey";

DROP INDEX "package_sale_status_createdAt_idx";
DROP INDEX "payment_record_memberEntitlementId_idx";
DROP INDEX "payment_record_packageSaleId_idx";
DROP INDEX "payment_record_serviceOrderId_idx";

ALTER TABLE "service_order" DROP COLUMN "addonUsages", DROP COLUMN "usedBonuses";
ALTER TABLE "service_order_item" DROP COLUMN "imageId";
ALTER TABLE "payment_record" DROP COLUMN "memberEntitlementId";
ALTER TABLE "package_sale" DROP COLUMN "status";

DROP TABLE "shop_setting";
DROP TABLE "notification_setting";
DROP TYPE "PackageSaleStatus";

COMMIT;
