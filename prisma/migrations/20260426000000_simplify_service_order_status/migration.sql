BEGIN;

CREATE TYPE "ServiceOrderStatus_new" AS ENUM ('RECEIVED', 'PROCESSING', 'DELIVERING', 'COMPLETED', 'CANCELLED');

ALTER TABLE "service_order" ALTER COLUMN "status" DROP DEFAULT;

ALTER TABLE "service_order"
    ALTER COLUMN "status" TYPE "ServiceOrderStatus_new"
    USING (
        CASE "status"::text
            WHEN 'PENDING' THEN 'PROCESSING'
            WHEN 'CHECKING' THEN 'PROCESSING'
            WHEN 'PENDING_REVIEW' THEN 'PROCESSING'
            ELSE "status"::text
        END
    )::"ServiceOrderStatus_new";

ALTER TABLE "service_order" ALTER COLUMN "status" SET DEFAULT 'RECEIVED';

DROP TYPE "ServiceOrderStatus";
ALTER TYPE "ServiceOrderStatus_new" RENAME TO "ServiceOrderStatus";

COMMIT;
