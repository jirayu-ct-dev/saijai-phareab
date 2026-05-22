-- DropForeignKey
ALTER TABLE "basket" DROP CONSTRAINT "basket_deletedById_fkey";

-- DropForeignKey
ALTER TABLE "service_order" DROP CONSTRAINT "service_order_basketId_fkey";

-- DropIndex
DROP INDEX "package_expiry_notification_entitlementId_daysBefore_key";

-- AlterTable
ALTER TABLE "service_order" DROP COLUMN "basketId";

-- DropTable
DROP TABLE "basket";

-- DropEnum
DROP TYPE "BasketStatus";

-- CreateIndex
CREATE INDEX "member_entitlement_customerId_status_idx" ON "member_entitlement"("customerId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "package_expiry_notification_entitlementId_daysBefore_endAtS_key" ON "package_expiry_notification"("entitlementId", "daysBefore", "endAtSnapshot");

-- CreateIndex
CREATE INDEX "service_order_quotationNo_idx" ON "service_order"("quotationNo");

-- CreateIndex
CREATE INDEX "service_order_status_deletedAt_createdAt_idx" ON "service_order"("status", "deletedAt", "createdAt");
