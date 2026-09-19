CREATE TABLE "service_included_item" (
    "storefrontServiceId" TEXT NOT NULL,
    "storefrontItemId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_included_item_pkey" PRIMARY KEY ("storefrontServiceId", "storefrontItemId")
);

CREATE INDEX "service_included_item_storefrontItemId_idx"
ON "service_included_item"("storefrontItemId");

ALTER TABLE "service_included_item"
ADD CONSTRAINT "service_included_item_storefrontServiceId_fkey"
FOREIGN KEY ("storefrontServiceId") REFERENCES "storefront_service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "service_included_item"
ADD CONSTRAINT "service_included_item_storefrontItemId_fkey"
FOREIGN KEY ("storefrontItemId") REFERENCES "storefront_item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Preserve current behavior initially; administrators can narrow each
-- service's clothing list after deployment.
INSERT INTO "service_included_item" ("storefrontServiceId", "storefrontItemId")
SELECT DISTINCT storefront_price."storefrontServiceId", storefront_price."storefrontItemId"
FROM "storefront_price" AS storefront_price
WHERE storefront_price."deletedAt" IS NULL
  AND storefront_price."isActive" = true;
