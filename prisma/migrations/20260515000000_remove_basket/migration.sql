-- Remove Basket model and its references from service_order.
ALTER TABLE "service_order" DROP CONSTRAINT IF EXISTS "service_order_basketId_fkey";
ALTER TABLE "service_order" DROP COLUMN IF EXISTS "basketId";
ALTER TABLE "basket" DROP CONSTRAINT IF EXISTS "basket_deletedById_fkey";
DROP TABLE IF EXISTS "basket";
DROP TYPE IF EXISTS "BasketStatus";
