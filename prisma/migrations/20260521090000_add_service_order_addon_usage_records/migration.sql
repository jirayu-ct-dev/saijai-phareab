-- CreateTable
CREATE TABLE "service_order_addon_usage" (
    "id" TEXT NOT NULL,
    "serviceOrderId" TEXT NOT NULL,
    "memberEntitlementId" TEXT,
    "productId" TEXT,
    "productName" TEXT,
    "credits" INTEGER NOT NULL,
    "deductOn" "DeductOn" NOT NULL DEFAULT 'CREATED',
    "deductedAt" TIMESTAMP(3),
    "refundedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_order_addon_usage_pkey" PRIMARY KEY ("id")
);

-- Backfill existing JSON snapshots without modifying legacy service_order.addonUsages.
INSERT INTO "service_order_addon_usage" (
    "id",
    "serviceOrderId",
    "memberEntitlementId",
    "productId",
    "productName",
    "credits",
    "deductOn",
    "deductedAt",
    "createdAt",
    "updatedAt"
)
SELECT
    'sou_' || md5(so."id" || ':' || usage.ordinality::text || ':' || COALESCE(usage.item->>'entitlementId', '')),
    so."id",
    me."id",
    NULLIF(usage.item->>'productId', ''),
    NULLIF(usage.item->>'productName', ''),
    GREATEST(
      CASE
        WHEN COALESCE(usage.item->>'credits', '') ~ '^[0-9]+$' THEN (usage.item->>'credits')::integer
        ELSE 0
      END,
      0
    ),
    'CREATED'::"DeductOn",
    CASE
      WHEN COALESCE(usage.item->>'appliedAt', '') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' THEN (usage.item->>'appliedAt')::timestamptz AT TIME ZONE 'UTC'
      ELSE so."createdAt"
    END,
    so."createdAt",
    so."updatedAt"
FROM "service_order" so
CROSS JOIN LATERAL jsonb_array_elements(
    CASE
      WHEN jsonb_typeof(so."addonUsages") = 'array' THEN so."addonUsages"
      ELSE '[]'::jsonb
    END
) WITH ORDINALITY AS usage(item, ordinality)
LEFT JOIN "member_entitlement" me ON me."id" = NULLIF(usage.item->>'entitlementId', '')
WHERE jsonb_typeof(so."addonUsages") = 'array'
  AND COALESCE(usage.item->>'credits', '') ~ '^[0-9]+$'
  AND (usage.item->>'credits')::integer > 0
ON CONFLICT ("id") DO NOTHING;

-- CreateIndex
CREATE INDEX "service_order_addon_usage_serviceOrderId_idx" ON "service_order_addon_usage"("serviceOrderId");
CREATE INDEX "service_order_addon_usage_memberEntitlementId_idx" ON "service_order_addon_usage"("memberEntitlementId");
CREATE INDEX "service_order_addon_usage_deductOn_deductedAt_idx" ON "service_order_addon_usage"("deductOn", "deductedAt");
CREATE INDEX "service_order_addon_usage_refundedAt_idx" ON "service_order_addon_usage"("refundedAt");

-- AddForeignKey
ALTER TABLE "service_order_addon_usage" ADD CONSTRAINT "service_order_addon_usage_serviceOrderId_fkey" FOREIGN KEY ("serviceOrderId") REFERENCES "service_order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "service_order_addon_usage" ADD CONSTRAINT "service_order_addon_usage_memberEntitlementId_fkey" FOREIGN KEY ("memberEntitlementId") REFERENCES "member_entitlement"("id") ON DELETE SET NULL ON UPDATE CASCADE;
