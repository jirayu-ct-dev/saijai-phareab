-- Package services are a separate catalog from storefront-priced services.
-- Keep the legacy PackageProduct.serviceId and ServiceIncludedItem tables for
-- an expand/contract window; existing package products are copied below.
CREATE TABLE "package_service" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "deletedById" TEXT,
    CONSTRAINT "package_service_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "package_service_included_item" (
    "packageServiceId" TEXT NOT NULL,
    "storefrontItemId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "package_service_included_item_pkey" PRIMARY KEY ("packageServiceId", "storefrontItemId")
);

CREATE INDEX "package_service_included_item_storefrontItemId_idx"
ON "package_service_included_item"("storefrontItemId");

-- One independent, active package-service record per legacy service assigned
-- to any package product. Its availability must not inherit storefront pricing
-- service state; an old price service may be disabled/deleted while packages
-- using its garment list are still active.
INSERT INTO "package_service" ("id", "name", "description", "isActive", "createdAt", "updatedAt")
SELECT
    'pkgsvc_' || storefront_service."id",
    storefront_service."name",
    storefront_service."description",
    true,
    storefront_service."createdAt",
    storefront_service."updatedAt"
FROM "storefront_service" AS storefront_service
WHERE storefront_service."id" IN (
    SELECT DISTINCT "serviceId"
    FROM "package_product"
    WHERE "serviceId" IS NOT NULL
)
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "package_service_included_item" ("packageServiceId", "storefrontItemId", "createdAt")
SELECT
    'pkgsvc_' || service_included_item."storefrontServiceId",
    service_included_item."storefrontItemId",
    service_included_item."createdAt"
FROM "service_included_item" AS service_included_item
WHERE service_included_item."storefrontServiceId" IN (
    SELECT DISTINCT "serviceId"
    FROM "package_product"
    WHERE "serviceId" IS NOT NULL
)
ON CONFLICT ("packageServiceId", "storefrontItemId") DO NOTHING;

ALTER TABLE "package_product" ADD COLUMN "packageServiceId" TEXT;
CREATE INDEX "package_product_packageServiceId_idx" ON "package_product"("packageServiceId");
UPDATE "package_product"
SET "packageServiceId" = 'pkgsvc_' || "serviceId"
WHERE "serviceId" IS NOT NULL;

ALTER TABLE "service_order_item"
    ADD COLUMN "storefrontItemId" TEXT,
    ADD COLUMN "isChargeable" BOOLEAN NOT NULL DEFAULT true;

UPDATE "service_order_item" AS order_item
SET "storefrontItemId" = storefront_price."storefrontItemId"
FROM "storefront_price" AS storefront_price
WHERE order_item."storefrontPriceId" = storefront_price."id"
  AND order_item."storefrontItemId" IS NULL;

-- Historically every line was either package-covered or storefront-billed.
UPDATE "service_order_item"
SET "isChargeable" = NOT "isPackageIncluded";

CREATE INDEX "service_order_item_storefrontItemId_idx" ON "service_order_item"("storefrontItemId");

ALTER TABLE "package_service"
ADD CONSTRAINT "package_service_deletedById_fkey"
FOREIGN KEY ("deletedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "package_service_included_item"
ADD CONSTRAINT "package_service_included_item_packageServiceId_fkey"
FOREIGN KEY ("packageServiceId") REFERENCES "package_service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "package_service_included_item"
ADD CONSTRAINT "package_service_included_item_storefrontItemId_fkey"
FOREIGN KEY ("storefrontItemId") REFERENCES "storefront_item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "package_product"
ADD CONSTRAINT "package_product_packageServiceId_fkey"
FOREIGN KEY ("packageServiceId") REFERENCES "package_service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "service_order_item"
ADD CONSTRAINT "service_order_item_storefrontItemId_fkey"
FOREIGN KEY ("storefrontItemId") REFERENCES "storefront_item"("id") ON DELETE SET NULL ON UPDATE CASCADE;
