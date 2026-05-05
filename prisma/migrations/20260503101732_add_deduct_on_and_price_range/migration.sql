-- CreateEnum
CREATE TYPE "DeductOn" AS ENUM ('CREATED', 'COMPLETED');

-- AlterTable
ALTER TABLE "package_product" ADD COLUMN     "deductOn" "DeductOn" NOT NULL DEFAULT 'CREATED';

-- AlterTable
ALTER TABLE "storefront_price" ADD COLUMN     "priceMax" DECIMAL(65,30),
ADD COLUMN     "priceMin" DECIMAL(65,30);
