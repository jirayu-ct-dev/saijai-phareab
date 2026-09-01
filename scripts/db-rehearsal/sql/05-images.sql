-- 05-images.sql — checklist 8.5 (images)
-- Aggregate-only. Safe inside a READ ONLY transaction. No PII in output.
--
-- Report-only: orphan images must NOT be deleted on the basis of this query
-- (plan decision F4 — Cloudinary/retention cleanup is out of scope).

SELECT 'item_direct_image_id_set' AS check_id,
       count(*) AS value
FROM "service_order_item"
WHERE "imageId" IS NOT NULL
UNION ALL
-- Direct image IDs without a matching image row (broken FK semantics).
SELECT 'item_direct_image_id_without_image_row',
       count(*)
FROM "service_order_item" soi
LEFT JOIN "image" i ON i.id = soi."imageId"
WHERE soi."imageId" IS NOT NULL
  AND i.id IS NULL
UNION ALL
-- Direct image IDs without a matching join row at all (backfill gap).
SELECT 'item_direct_image_id_without_join_row',
       count(*)
FROM "service_order_item" soi
LEFT JOIN "service_order_item_image" soiimg
  ON soiimg."serviceOrderItemId" = soi.id
 AND soiimg."imageId" = soi."imageId"
WHERE soi."imageId" IS NOT NULL
  AND soiimg.id IS NULL
UNION ALL
-- Direct image IDs without a matching ACTIVE join row (join row soft-deleted).
SELECT 'item_direct_image_id_without_active_join_row',
       count(*)
FROM "service_order_item" soi
LEFT JOIN "service_order_item_image" soiimg
  ON soiimg."serviceOrderItemId" = soi.id
 AND soiimg."imageId" = soi."imageId"
 AND soiimg."deletedAt" IS NULL
WHERE soi."imageId" IS NOT NULL
  AND soiimg.id IS NULL
UNION ALL
-- Duplicate active item/image pairs. Expect 0.
SELECT 'duplicate_active_item_image_pairs',
       count(*)
FROM (
  SELECT "serviceOrderItemId", "imageId"
  FROM "service_order_item_image"
  WHERE "deletedAt" IS NULL
  GROUP BY "serviceOrderItemId", "imageId"
  HAVING count(*) > 1
) d
UNION ALL
-- Join rows pointing at an image that no longer exists. Expect 0.
SELECT 'join_rows_without_image_row',
       count(*)
FROM "service_order_item_image" soiimg
LEFT JOIN "image" i ON i.id = soiimg."imageId"
WHERE i.id IS NULL
UNION ALL
-- Image registry totals (context, not a pass/fail invariant).
SELECT 'image_total_rows',
       count(*)
FROM "image"
UNION ALL
SELECT 'image_active_rows',
       count(*) FILTER (WHERE "deletedAt" IS NULL)
FROM "image"
UNION ALL
SELECT 'image_active_with_owner',
       count(*) FILTER (WHERE "userId" IS NOT NULL)
FROM "image"
WHERE "deletedAt" IS NULL
UNION ALL
-- Orphan active images: not referenced by any direct image_id column nor by
-- the normalized join table. Report-only — do not delete based on this.
SELECT 'image_active_orphans_report_only',
       count(*)
FROM "image" i
WHERE i."deletedAt" IS NULL
  AND NOT EXISTS (SELECT 1 FROM "service_order_item" soi WHERE soi."imageId" = i.id)
  AND NOT EXISTS (SELECT 1 FROM "service_order_item_image" soiimg WHERE soiimg."imageId" = i.id)
  AND NOT EXISTS (SELECT 1 FROM "service_order" so WHERE so."imageId" = i.id)
  AND NOT EXISTS (SELECT 1 FROM "service_order" so2 WHERE so2."deliveryImageId" = i.id)
  AND NOT EXISTS (SELECT 1 FROM "payment_record" pr WHERE pr."slipImageId" = i.id);
