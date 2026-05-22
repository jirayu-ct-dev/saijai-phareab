-- AlterTable
ALTER TABLE "service_order" ADD COLUMN     "deliveryImageId" TEXT;

-- AddForeignKey
ALTER TABLE "service_order" ADD CONSTRAINT "service_order_deliveryImageId_fkey" FOREIGN KEY ("deliveryImageId") REFERENCES "image"("id") ON DELETE SET NULL ON UPDATE CASCADE;
