-- CreateEnum
CREATE TYPE "CustomerAccountStatus" AS ENUM ('OFFLINE', 'ACTIVE');

-- AlterTable
ALTER TABLE "user"
  ADD COLUMN "normalizedPhoneNumber" TEXT,
  ADD COLUMN "customerAccountStatus" "CustomerAccountStatus" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN "claimedAt" TIMESTAMP(3),
  ADD COLUMN "createdByStaffId" TEXT;

-- Validate every non-empty legacy phone before backfilling. The migration must
-- stop instead of silently dropping an unsupported value from the unique key.
DO $$
DECLARE
  invalid_count INTEGER;
BEGIN
  WITH compacted AS (
    SELECT
      "id",
      translate(
        translate("phoneNumber", '๐๑๒๓๔๕๖๗๘๙', '0123456789'),
        ' -()' || chr(9) || chr(10) || chr(11) || chr(12) || chr(13) || chr(160),
        ''
      ) AS compact
    FROM "user"
    WHERE nullif(
      translate("phoneNumber", ' ' || chr(9) || chr(10) || chr(11) || chr(12) || chr(13) || chr(160), ''),
      ''
    ) IS NOT NULL
  ), normalized AS (
    SELECT
      "id",
      CASE
        WHEN compact LIKE '+66%' THEN '0' || substr(compact, 4)
        ELSE compact
      END AS phone
    FROM compacted
  )
  SELECT count(*) INTO invalid_count
  FROM normalized
  WHERE phone !~ '^0[0-9]{8,9}$';

  IF invalid_count > 0 THEN
    RAISE EXCEPTION USING
      MESSAGE = format(
        'Cannot backfill normalized phone numbers: %s user row(s) contain unsupported phone values. Correct or clear those phoneNumber values, then retry the migration.',
        invalid_count
      );
  END IF;
END $$;

-- Backfill using the same rules as shared/utils/phone.ts.
WITH compacted AS (
  SELECT
    "id",
    translate(
      translate("phoneNumber", '๐๑๒๓๔๕๖๗๘๙', '0123456789'),
      ' -()' || chr(9) || chr(10) || chr(11) || chr(12) || chr(13) || chr(160),
      ''
    ) AS compact
  FROM "user"
  WHERE nullif(
    translate("phoneNumber", ' ' || chr(9) || chr(10) || chr(11) || chr(12) || chr(13) || chr(160), ''),
    ''
  ) IS NOT NULL
), normalized AS (
  SELECT
    "id",
    CASE
      WHEN compact LIKE '+66%' THEN '0' || substr(compact, 4)
      ELSE compact
    END AS phone
  FROM compacted
)
UPDATE "user" AS target
SET "normalizedPhoneNumber" = normalized.phone
FROM normalized
WHERE target."id" = normalized."id";

-- Active duplicate phone owners need an explicit human decision. Soft-deleted
-- users are intentionally excluded from this constraint.
DO $$
DECLARE
  duplicate_count INTEGER;
BEGIN
  SELECT count(*) INTO duplicate_count
  FROM (
    SELECT "normalizedPhoneNumber"
    FROM "user"
    WHERE "deletedAt" IS NULL
      AND "normalizedPhoneNumber" IS NOT NULL
    GROUP BY "normalizedPhoneNumber"
    HAVING count(*) > 1
  ) AS duplicates;

  IF duplicate_count > 0 THEN
    RAISE EXCEPTION USING
      MESSAGE = format(
        'Cannot enforce unique customer phone numbers: %s normalized phone value(s) belong to multiple active users. Resolve the duplicates, then retry the migration.',
        duplicate_count
      );
  END IF;
END $$;

-- Prisma cannot represent a partial unique index in schema.prisma.
CREATE UNIQUE INDEX "user_normalizedPhoneNumber_active_key"
  ON "user"("normalizedPhoneNumber")
  WHERE "deletedAt" IS NULL AND "normalizedPhoneNumber" IS NOT NULL;

-- CreateTable
CREATE TABLE "customer_claim_token" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "customer_claim_token_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_createdByStaffId_idx" ON "user"("createdByStaffId");
CREATE UNIQUE INDEX "customer_claim_token_tokenHash_key" ON "customer_claim_token"("tokenHash");
CREATE INDEX "customer_claim_token_userId_idx" ON "customer_claim_token"("userId");
CREATE INDEX "customer_claim_token_expiresAt_idx" ON "customer_claim_token"("expiresAt");
-- There may be only one usable claim token per customer. The issue flow
-- revokes the previous token before inserting its replacement; this index also
-- closes the concurrent-issuance race at the database boundary.
CREATE UNIQUE INDEX "customer_claim_token_userId_active_key"
  ON "customer_claim_token"("userId")
  WHERE "usedAt" IS NULL AND "revokedAt" IS NULL;

-- AddForeignKey
ALTER TABLE "user"
  ADD CONSTRAINT "user_createdByStaffId_fkey"
  FOREIGN KEY ("createdByStaffId") REFERENCES "user"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "customer_claim_token"
  ADD CONSTRAINT "customer_claim_token_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "user"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "customer_claim_token"
  ADD CONSTRAINT "customer_claim_token_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "user"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
