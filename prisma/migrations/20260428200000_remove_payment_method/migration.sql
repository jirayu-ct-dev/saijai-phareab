-- Remove payment_method column, verification fields, and PaymentMethod enum
ALTER TABLE "payment_record"
  DROP COLUMN IF EXISTS "payment_method",
  DROP COLUMN IF EXISTS "verified_by_id",
  DROP COLUMN IF EXISTS "verified_at",
  DROP COLUMN IF EXISTS "rejection_reason";

DROP INDEX IF EXISTS "payment_record_payment_method_created_at_idx";

DROP TYPE IF EXISTS "PaymentMethod" CASCADE;
