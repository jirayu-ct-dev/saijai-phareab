-- CreateTable
CREATE TABLE "service_order_item_image" (
    "id" TEXT NOT NULL,
    "serviceOrderItemId" TEXT NOT NULL,
    "imageId" TEXT NOT NULL,
    "isDamaged" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "deletedById" TEXT,

    CONSTRAINT "service_order_item_image_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "service_order_item_image_serviceOrderItemId_idx" ON "service_order_item_image"("serviceOrderItemId");

-- CreateIndex
CREATE INDEX "service_order_item_image_imageId_idx" ON "service_order_item_image"("imageId");

-- AddForeignKey
ALTER TABLE "service_order_item_image" ADD CONSTRAINT "service_order_item_image_serviceOrderItemId_fkey" FOREIGN KEY ("serviceOrderItemId") REFERENCES "service_order_item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_order_item_image" ADD CONSTRAINT "service_order_item_image_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "image"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_order_item_image" ADD CONSTRAINT "service_order_item_image_deletedById_fkey" FOREIGN KEY ("deletedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
