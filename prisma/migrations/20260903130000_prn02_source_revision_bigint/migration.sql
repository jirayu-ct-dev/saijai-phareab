-- PRN-02 follow-up: the source revision is derived from the payment row's
-- updatedAt epoch milliseconds, which exceeds the signed 32-bit range of the
-- original INTEGER column.
ALTER TABLE "print_job" ALTER COLUMN "sourceRevision" TYPE BIGINT;
