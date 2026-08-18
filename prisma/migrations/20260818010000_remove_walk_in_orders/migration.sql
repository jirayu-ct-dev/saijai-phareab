-- This migration deliberately refuses to guess ownership or delete historical
-- data. Remove or reassign the legacy walk-in data and system user manually,
-- with a verified backup, before retrying it.
DO $$
DECLARE
  legacy_order_count INTEGER;
  system_user_count INTEGER;
BEGIN
  SELECT count(*) INTO legacy_order_count
  FROM "service_order"
  WHERE "isWalkIn" = true
     OR "walkInName" IS NOT NULL
     OR "walkInPhone" IS NOT NULL;

  IF legacy_order_count > 0 THEN
    RAISE EXCEPTION USING
      MESSAGE = format(
        'Cannot remove walk-in order fields: %s service_order row(s) still contain walk-in data. Delete or reassign them explicitly after taking a backup, then retry the migration.',
        legacy_order_count
      );
  END IF;

  SELECT count(*) INTO system_user_count
  FROM "user"
  WHERE lower("email") = 'walkin@saijai.local';

  IF system_user_count > 0 THEN
    RAISE EXCEPTION USING
      MESSAGE = 'Cannot finish walk-in removal while walkin@saijai.local still exists. Verify and remove all of its relations, then delete the system user explicitly and retry the migration.';
  END IF;
END $$;

-- AlterTable
ALTER TABLE "service_order"
  DROP COLUMN "isWalkIn",
  DROP COLUMN "walkInName",
  DROP COLUMN "walkInPhone";
