/*
  Warnings:

  - You are about to drop the `order` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `order_item` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `package` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `payment_transaction` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `user_package` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "PackageSaleStatus" AS ENUM ('DRAFT', 'PENDING', 'PAID', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PackageItemType" AS ENUM ('MAIN', 'ADDON');

-- CreateEnum
CREATE TYPE "EntitlementStatus" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ServiceOrderStatus" AS ENUM ('RECEIVED', 'PENDING', 'CHECKING', 'PROCESSING', 'PENDING_REVIEW', 'COMPLETED', 'CANCELLED');

-- DropForeignKey
ALTER TABLE "order" DROP CONSTRAINT "order_basketId_fkey";

-- DropForeignKey
ALTER TABLE "order" DROP CONSTRAINT "order_customerId_fkey";

-- DropForeignKey
ALTER TABLE "order" DROP CONSTRAINT "order_deletedById_fkey";

-- DropForeignKey
ALTER TABLE "order" DROP CONSTRAINT "order_employeeId_fkey";

-- DropForeignKey
ALTER TABLE "order" DROP CONSTRAINT "order_imageId_fkey";

-- DropForeignKey
ALTER TABLE "order" DROP CONSTRAINT "order_userPackageId_fkey";

-- DropForeignKey
ALTER TABLE "order_item" DROP CONSTRAINT "order_item_deletedById_fkey";

-- DropForeignKey
ALTER TABLE "order_item" DROP CONSTRAINT "order_item_imageId_fkey";

-- DropForeignKey
ALTER TABLE "order_item" DROP CONSTRAINT "order_item_orderId_fkey";

-- DropForeignKey
ALTER TABLE "order_item" DROP CONSTRAINT "order_item_storefrontPriceId_fkey";

-- DropForeignKey
ALTER TABLE "package" DROP CONSTRAINT "package_deletedById_fkey";

-- DropForeignKey
ALTER TABLE "package_bonus" DROP CONSTRAINT "package_bonus_packageId_fkey";

-- DropForeignKey
ALTER TABLE "package_bundle" DROP CONSTRAINT "package_bundle_addonPackageId_fkey";

-- DropForeignKey
ALTER TABLE "package_bundle" DROP CONSTRAINT "package_bundle_mainPackageId_fkey";

-- DropForeignKey
ALTER TABLE "payment_transaction" DROP CONSTRAINT "payment_transaction_deletedById_fkey";

-- DropForeignKey
ALTER TABLE "payment_transaction" DROP CONSTRAINT "payment_transaction_orderId_fkey";

-- DropForeignKey
ALTER TABLE "payment_transaction" DROP CONSTRAINT "payment_transaction_slipImageId_fkey";

-- DropForeignKey
ALTER TABLE "payment_transaction" DROP CONSTRAINT "payment_transaction_userId_fkey";

-- DropForeignKey
ALTER TABLE "payment_transaction" DROP CONSTRAINT "payment_transaction_userPackageId_fkey";

-- DropForeignKey
ALTER TABLE "payment_transaction" DROP CONSTRAINT "payment_transaction_verifiedById_fkey";

-- DropForeignKey
ALTER TABLE "user_package" DROP CONSTRAINT "user_package_deletedById_fkey";

-- DropForeignKey
ALTER TABLE "user_package" DROP CONSTRAINT "user_package_packageId_fkey";

-- DropForeignKey
ALTER TABLE "user_package" DROP CONSTRAINT "user_package_parentUserPackageId_fkey";

-- DropForeignKey
ALTER TABLE "user_package" DROP CONSTRAINT "user_package_userId_fkey";

-- DropTable
DROP TABLE "order";

-- DropTable
DROP TABLE "order_item";

-- DropTable
DROP TABLE "package";

-- DropTable
DROP TABLE "payment_transaction";

-- DropTable
DROP TABLE "user_package";

-- DropEnum
DROP TYPE "OrderStatus";

-- DropEnum
DROP TYPE "OrderType";

-- DropEnum
DROP TYPE "PackageStatus";

-- CreateTable
CREATE TABLE "package_product" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "packageType" "PackageType" NOT NULL DEFAULT 'MAIN',
    "price" DECIMAL(65,30) NOT NULL,
    "credits" INTEGER,
    "bonusCredits" INTEGER DEFAULT 0,
    "validityDays" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "deletedById" TEXT,

    CONSTRAINT "package_product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "package_sale" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "soldById" TEXT,
    "status" "PackageSaleStatus" NOT NULL DEFAULT 'DRAFT',
    "subtotalAmount" DECIMAL(65,30) NOT NULL,
    "discountAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(65,30) NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "deletedById" TEXT,

    CONSTRAINT "package_sale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "package_sale_item" (
    "id" TEXT NOT NULL,
    "packageSaleId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "itemType" "PackageItemType" NOT NULL,
    "qty" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(65,30) NOT NULL,
    "totalPrice" DECIMAL(65,30) NOT NULL,
    "attachedToItemId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "package_sale_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "member_entitlement" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "sourceSaleItemId" TEXT,
    "productId" TEXT NOT NULL,
    "parentEntitlementId" TEXT,
    "status" "EntitlementStatus" NOT NULL DEFAULT 'PENDING',
    "creditInitial" INTEGER,
    "creditRemaining" INTEGER,
    "startAt" TIMESTAMP(3),
    "endAt" TIMESTAMP(3),
    "activatedAt" TIMESTAMP(3),
    "suspendedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "deletedById" TEXT,

    CONSTRAINT "member_entitlement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_order" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "employeeId" TEXT,
    "status" "ServiceOrderStatus" NOT NULL DEFAULT 'PENDING',
    "isWalkIn" BOOLEAN NOT NULL DEFAULT false,
    "walkInName" TEXT,
    "walkInPhone" TEXT,
    "memberEntitlementId" TEXT,
    "creditUsed" INTEGER,
    "hangerCharge" JSONB,
    "totalAmount" DECIMAL(65,30),
    "basketId" TEXT,
    "note" TEXT,
    "usedBonuses" JSONB,
    "deliveryAddressSnapshot" JSONB,
    "imageId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "deletedById" TEXT,

    CONSTRAINT "service_order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_order_item" (
    "id" TEXT NOT NULL,
    "serviceOrderId" TEXT NOT NULL,
    "storefrontPriceId" TEXT NOT NULL,
    "isPackageIncluded" BOOLEAN NOT NULL DEFAULT false,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(65,30) NOT NULL,
    "totalPrice" DECIMAL(65,30) NOT NULL,
    "imageId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "deletedById" TEXT,

    CONSTRAINT "service_order_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_record" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "memberEntitlementId" TEXT,
    "packageSaleId" TEXT,
    "serviceOrderId" TEXT,
    "amount" DECIMAL(65,30) NOT NULL,
    "paymentMethod" "PaymentMethod" NOT NULL,
    "slipImageId" TEXT,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "referenceNo" TEXT,
    "note" TEXT,
    "paidAt" TIMESTAMP(3),
    "metadata" JSONB,
    "rejectionReason" TEXT,
    "verifiedById" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "deletedById" TEXT,

    CONSTRAINT "payment_record_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "package_sale_customerId_createdAt_idx" ON "package_sale"("customerId", "createdAt");

-- CreateIndex
CREATE INDEX "package_sale_status_createdAt_idx" ON "package_sale"("status", "createdAt");

-- CreateIndex
CREATE INDEX "package_sale_item_packageSaleId_idx" ON "package_sale_item"("packageSaleId");

-- CreateIndex
CREATE INDEX "package_sale_item_productId_idx" ON "package_sale_item"("productId");

-- CreateIndex
CREATE INDEX "package_sale_item_attachedToItemId_idx" ON "package_sale_item"("attachedToItemId");

-- CreateIndex
CREATE INDEX "member_entitlement_customerId_idx" ON "member_entitlement"("customerId");

-- CreateIndex
CREATE INDEX "member_entitlement_productId_idx" ON "member_entitlement"("productId");

-- CreateIndex
CREATE INDEX "member_entitlement_sourceSaleItemId_idx" ON "member_entitlement"("sourceSaleItemId");

-- CreateIndex
CREATE INDEX "member_entitlement_parentEntitlementId_idx" ON "member_entitlement"("parentEntitlementId");

-- CreateIndex
CREATE INDEX "member_entitlement_status_endAt_idx" ON "member_entitlement"("status", "endAt");

-- CreateIndex
CREATE INDEX "service_order_customerId_idx" ON "service_order"("customerId");

-- CreateIndex
CREATE INDEX "service_order_employeeId_idx" ON "service_order"("employeeId");

-- CreateIndex
CREATE INDEX "service_order_memberEntitlementId_idx" ON "service_order"("memberEntitlementId");

-- CreateIndex
CREATE INDEX "service_order_status_createdAt_idx" ON "service_order"("status", "createdAt");

-- CreateIndex
CREATE INDEX "service_order_item_serviceOrderId_idx" ON "service_order_item"("serviceOrderId");

-- CreateIndex
CREATE INDEX "service_order_item_storefrontPriceId_idx" ON "service_order_item"("storefrontPriceId");

-- CreateIndex
CREATE INDEX "payment_record_userId_createdAt_idx" ON "payment_record"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "payment_record_memberEntitlementId_idx" ON "payment_record"("memberEntitlementId");

-- CreateIndex
CREATE INDEX "payment_record_packageSaleId_idx" ON "payment_record"("packageSaleId");

-- CreateIndex
CREATE INDEX "payment_record_serviceOrderId_idx" ON "payment_record"("serviceOrderId");

-- CreateIndex
CREATE INDEX "payment_record_paymentMethod_createdAt_idx" ON "payment_record"("paymentMethod", "createdAt");

-- CreateIndex
CREATE INDEX "payment_record_referenceNo_idx" ON "payment_record"("referenceNo");

-- CreateIndex
CREATE INDEX "payment_record_status_createdAt_idx" ON "payment_record"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "package_product" ADD CONSTRAINT "package_product_deletedById_fkey" FOREIGN KEY ("deletedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "package_bundle" ADD CONSTRAINT "package_bundle_mainPackageId_fkey" FOREIGN KEY ("mainPackageId") REFERENCES "package_product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "package_bundle" ADD CONSTRAINT "package_bundle_addonPackageId_fkey" FOREIGN KEY ("addonPackageId") REFERENCES "package_product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "package_bonus" ADD CONSTRAINT "package_bonus_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "package_product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "package_sale" ADD CONSTRAINT "package_sale_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "package_sale" ADD CONSTRAINT "package_sale_soldById_fkey" FOREIGN KEY ("soldById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "package_sale" ADD CONSTRAINT "package_sale_deletedById_fkey" FOREIGN KEY ("deletedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "package_sale_item" ADD CONSTRAINT "package_sale_item_packageSaleId_fkey" FOREIGN KEY ("packageSaleId") REFERENCES "package_sale"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "package_sale_item" ADD CONSTRAINT "package_sale_item_productId_fkey" FOREIGN KEY ("productId") REFERENCES "package_product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "package_sale_item" ADD CONSTRAINT "package_sale_item_attachedToItemId_fkey" FOREIGN KEY ("attachedToItemId") REFERENCES "package_sale_item"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_entitlement" ADD CONSTRAINT "member_entitlement_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_entitlement" ADD CONSTRAINT "member_entitlement_sourceSaleItemId_fkey" FOREIGN KEY ("sourceSaleItemId") REFERENCES "package_sale_item"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_entitlement" ADD CONSTRAINT "member_entitlement_productId_fkey" FOREIGN KEY ("productId") REFERENCES "package_product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_entitlement" ADD CONSTRAINT "member_entitlement_parentEntitlementId_fkey" FOREIGN KEY ("parentEntitlementId") REFERENCES "member_entitlement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_entitlement" ADD CONSTRAINT "member_entitlement_deletedById_fkey" FOREIGN KEY ("deletedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_order" ADD CONSTRAINT "service_order_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_order" ADD CONSTRAINT "service_order_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_order" ADD CONSTRAINT "service_order_memberEntitlementId_fkey" FOREIGN KEY ("memberEntitlementId") REFERENCES "member_entitlement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_order" ADD CONSTRAINT "service_order_basketId_fkey" FOREIGN KEY ("basketId") REFERENCES "basket"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_order" ADD CONSTRAINT "service_order_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "image"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_order" ADD CONSTRAINT "service_order_deletedById_fkey" FOREIGN KEY ("deletedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_order_item" ADD CONSTRAINT "service_order_item_serviceOrderId_fkey" FOREIGN KEY ("serviceOrderId") REFERENCES "service_order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_order_item" ADD CONSTRAINT "service_order_item_storefrontPriceId_fkey" FOREIGN KEY ("storefrontPriceId") REFERENCES "storefront_price"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_order_item" ADD CONSTRAINT "service_order_item_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "image"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_order_item" ADD CONSTRAINT "service_order_item_deletedById_fkey" FOREIGN KEY ("deletedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_record" ADD CONSTRAINT "payment_record_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_record" ADD CONSTRAINT "payment_record_memberEntitlementId_fkey" FOREIGN KEY ("memberEntitlementId") REFERENCES "member_entitlement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_record" ADD CONSTRAINT "payment_record_packageSaleId_fkey" FOREIGN KEY ("packageSaleId") REFERENCES "package_sale"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_record" ADD CONSTRAINT "payment_record_serviceOrderId_fkey" FOREIGN KEY ("serviceOrderId") REFERENCES "service_order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_record" ADD CONSTRAINT "payment_record_slipImageId_fkey" FOREIGN KEY ("slipImageId") REFERENCES "image"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_record" ADD CONSTRAINT "payment_record_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_record" ADD CONSTRAINT "payment_record_deletedById_fkey" FOREIGN KEY ("deletedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
