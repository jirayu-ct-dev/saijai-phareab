-- AlterTable
ALTER TABLE "notification_setting"
  ADD COLUMN "notifyCustomerOnPackageExpiring" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "package_expiry_notification" (
  "id" TEXT NOT NULL,
  "entitlementId" TEXT NOT NULL,
  "daysBefore" INTEGER NOT NULL,
  "endAtSnapshot" TIMESTAMP(3) NOT NULL,
  "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "package_expiry_notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "package_expiry_notification_entitlementId_daysBefore_key"
  ON "package_expiry_notification"("entitlementId", "daysBefore");

-- CreateIndex
CREATE INDEX "package_expiry_notification_sentAt_idx"
  ON "package_expiry_notification"("sentAt");

-- AddForeignKey
ALTER TABLE "package_expiry_notification"
  ADD CONSTRAINT "package_expiry_notification_entitlementId_fkey"
  FOREIGN KEY ("entitlementId") REFERENCES "member_entitlement"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
