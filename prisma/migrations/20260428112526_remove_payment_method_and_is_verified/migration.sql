/*
  Warnings:

  - You are about to drop the column `rejectionReason` on the `payment_record` table. All the data in the column will be lost.
  - You are about to drop the column `verifiedAt` on the `payment_record` table. All the data in the column will be lost.
  - You are about to drop the column `verifiedById` on the `payment_record` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "payment_record" DROP CONSTRAINT "payment_record_verifiedById_fkey";

-- DropForeignKey
ALTER TABLE "service_order_item" DROP CONSTRAINT "service_order_item_storefrontPriceId_fkey";

-- AlterTable
ALTER TABLE "payment_record" DROP COLUMN "rejectionReason",
DROP COLUMN "verifiedAt",
DROP COLUMN "verifiedById";

-- AddForeignKey
ALTER TABLE "service_order_item" ADD CONSTRAINT "service_order_item_storefrontPriceId_fkey" FOREIGN KEY ("storefrontPriceId") REFERENCES "storefront_price"("id") ON DELETE SET NULL ON UPDATE CASCADE;
