/*
  Warnings:

  - You are about to drop the column `parentEntitlementId` on the `member_entitlement` table. All the data in the column will be lost.
  - You are about to drop the column `bonusCredits` on the `package_product` table. All the data in the column will be lost.
  - You are about to drop the column `attachedToItemId` on the `package_sale_item` table. All the data in the column will be lost.
  - You are about to drop the column `referenceNo` on the `payment_record` table. All the data in the column will be lost.
  - You are about to drop the `package_bonus` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `package_bundle` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[paymentNo]` on the table `payment_record` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[orderNo]` on the table `service_order` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "member_entitlement" DROP CONSTRAINT "member_entitlement_parentEntitlementId_fkey";

-- DropForeignKey
ALTER TABLE "package_bonus" DROP CONSTRAINT "package_bonus_deletedById_fkey";

-- DropForeignKey
ALTER TABLE "package_bonus" DROP CONSTRAINT "package_bonus_packageId_fkey";

-- DropForeignKey
ALTER TABLE "package_bonus" DROP CONSTRAINT "package_bonus_storefrontPriceId_fkey";

-- DropForeignKey
ALTER TABLE "package_bundle" DROP CONSTRAINT "package_bundle_addonPackageId_fkey";

-- DropForeignKey
ALTER TABLE "package_bundle" DROP CONSTRAINT "package_bundle_mainPackageId_fkey";

-- DropForeignKey
ALTER TABLE "package_sale_item" DROP CONSTRAINT "package_sale_item_attachedToItemId_fkey";

-- DropIndex
DROP INDEX "member_entitlement_parentEntitlementId_idx";

-- DropIndex
DROP INDEX "package_sale_item_attachedToItemId_idx";

-- DropIndex
DROP INDEX "payment_record_referenceNo_idx";

-- AlterTable
ALTER TABLE "member_entitlement" DROP COLUMN "parentEntitlementId";

-- AlterTable
ALTER TABLE "package_product" DROP COLUMN "bonusCredits";

-- AlterTable
ALTER TABLE "package_sale_item" DROP COLUMN "attachedToItemId";

-- AlterTable
ALTER TABLE "payment_record" DROP COLUMN "referenceNo",
ADD COLUMN     "paymentNo" TEXT;

-- AlterTable
ALTER TABLE "service_order" ADD COLUMN     "discountAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
ADD COLUMN     "dueAt" TIMESTAMP(3),
ADD COLUMN     "orderNo" TEXT,
ADD COLUMN     "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "subtotalAmount" DECIMAL(65,30) NOT NULL DEFAULT 0;

-- DropTable
DROP TABLE "package_bonus";

-- DropTable
DROP TABLE "package_bundle";

-- CreateIndex
CREATE UNIQUE INDEX "payment_record_paymentNo_key" ON "payment_record"("paymentNo");

-- CreateIndex
CREATE INDEX "payment_record_paymentNo_idx" ON "payment_record"("paymentNo");

-- CreateIndex
CREATE UNIQUE INDEX "service_order_orderNo_key" ON "service_order"("orderNo");

-- CreateIndex
CREATE INDEX "service_order_orderNo_idx" ON "service_order"("orderNo");
