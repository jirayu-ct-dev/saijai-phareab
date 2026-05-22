ALTER TABLE "business_setting"
  ADD COLUMN "washFoldPricePerKg" DECIMAL(65,30) NOT NULL DEFAULT 60,
  ADD COLUMN "washFoldMinKg" DECIMAL(65,30) NOT NULL DEFAULT 0;

ALTER TABLE "service_order_item"
  ALTER COLUMN "storefrontPriceId" DROP NOT NULL,
  ADD COLUMN "weightKg" DECIMAL(65,30),
  ADD COLUMN "weightLabel" TEXT;
