-- Recreate PaymentStatus enum without PARTIALLY_PAID
ALTER TYPE "PaymentStatus" RENAME TO "PaymentStatus_old";

CREATE TYPE "PaymentStatus" AS ENUM ('UNPAID', 'PENDING_VERIFICATION', 'PAID', 'CANCELLED');

ALTER TABLE "payment_record"
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "status" TYPE "PaymentStatus" USING ("status"::text::"PaymentStatus"),
  ALTER COLUMN "status" SET DEFAULT 'UNPAID';

DROP TYPE "PaymentStatus_old";
