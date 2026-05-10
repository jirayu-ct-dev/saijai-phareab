-- AlterTable
ALTER TABLE "service_order" DROP COLUMN "hasDelivery";

-- AlterTable
ALTER TABLE "package_product" ADD COLUMN     "isDelivery" BOOLEAN NOT NULL DEFAULT false;
