-- AlterTable
ALTER TABLE "storefront_item" ADD COLUMN     "categoryId" TEXT;

-- CreateTable
CREATE TABLE "storefront_category" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "deletedById" TEXT,

    CONSTRAINT "storefront_category_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "storefront_category" ADD CONSTRAINT "storefront_category_deletedById_fkey" FOREIGN KEY ("deletedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "storefront_item" ADD CONSTRAINT "storefront_item_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "storefront_category"("id") ON DELETE SET NULL ON UPDATE CASCADE;
