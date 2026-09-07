-- AlterTable
ALTER TABLE "package_product"
ADD COLUMN "isPublic" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "serviceId" TEXT;

-- CreateIndex
CREATE INDEX "package_product_serviceId_idx" ON "package_product"("serviceId");

-- AddForeignKey
ALTER TABLE "package_product"
ADD CONSTRAINT "package_product_serviceId_fkey"
FOREIGN KEY ("serviceId") REFERENCES "storefront_service"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
