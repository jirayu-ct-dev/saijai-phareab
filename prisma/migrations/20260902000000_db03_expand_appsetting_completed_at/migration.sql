-- DB-03 Expand migration (plan-database-consolidation.md sections 4.2/4.6)
-- Purely additive: new nullable AppSetting target columns on the physical
-- "business_setting" table and the nullable "completedAt" business-event
-- timestamp on "service_order".
--
-- No drops, renames, defaults, or backfills. `null` means "not migrated yet";
-- legacy read/write paths keep using shop_setting / notification_setting and
-- the deliveredAt fallback until the DB-06 read cutover. Post-cutover policy
-- lives in application code, never here.
--
-- Lock behavior: ADD COLUMN without a default is a catalog-only change in
-- PostgreSQL; it takes a brief ACCESS EXCLUSIVE lock with no table rewrite.
-- The only tables touched are the 1-row business_setting singleton and
-- service_order, so the lock window is negligible.
--
-- NOTE: `prisma migrate dev` also proposed dropping the two intentional
-- partial unique indexes "customer_claim_token_userId_active_key" and
-- "user_normalizedPhoneNumber_active_key". They are correct production
-- objects that Prisma cannot represent in schema.prisma (see
-- 20260818000000_add_reusable_customer_accounts) and MUST NOT be dropped
-- here; strip any such proposal from generated migrations until partial-index
-- support lands.

-- AlterTable
ALTER TABLE "business_setting" ADD COLUMN     "address" TEXT,
ADD COLUMN     "lineQrEnabled" BOOLEAN,
ADD COLUMN     "lineQrImageUrl" TEXT,
ADD COLUMN     "logoUrl" TEXT,
ADD COLUMN     "name" TEXT,
ADD COLUMN     "notifyCustomerOnCancelled" BOOLEAN,
ADD COLUMN     "notifyCustomerOnCompleted" BOOLEAN,
ADD COLUMN     "notifyCustomerOnDelivering" BOOLEAN,
ADD COLUMN     "notifyCustomerOnPackageExpiring" BOOLEAN,
ADD COLUMN     "notifyCustomerOnProcessing" BOOLEAN,
ADD COLUMN     "notifyCustomerOnQuotation" BOOLEAN,
ADD COLUMN     "notifyCustomerOnReceived" BOOLEAN,
ADD COLUMN     "notifyCustomerReceipt" BOOLEAN,
ADD COLUMN     "notifyStaffOnNewOrder" BOOLEAN,
ADD COLUMN     "paymentQrActivatedAt" TIMESTAMP(3),
ADD COLUMN     "paymentQrActivatedById" TEXT,
ADD COLUMN     "paymentQrConfigVersion" INTEGER,
ADD COLUMN     "paymentQrEnabled" BOOLEAN,
ADD COLUMN     "paymentQrKeyVersion" INTEGER,
ADD COLUMN     "paymentQrProvider" TEXT,
ADD COLUMN     "paymentQrReceiverCiphertext" TEXT,
ADD COLUMN     "paymentQrReceiverLabel" TEXT,
ADD COLUMN     "paymentQrReceiverLast4" TEXT,
ADD COLUMN     "paymentQrReceiverType" TEXT,
ADD COLUMN     "paymentQrUpdatedById" TEXT,
ADD COLUMN     "phone" TEXT;

-- AlterTable
ALTER TABLE "service_order" ADD COLUMN     "completedAt" TIMESTAMP(3);
