-- CreateEnum
CREATE TYPE "PickupConfirmationResponse" AS ENUM ('HOME_PICKUP', 'SELF_DROPOFF', 'SKIP', 'CONTACT_REQUESTED');

CREATE TYPE "PickupConfirmationStatus" AS ENUM ('ACTIVE', 'CLOSED', 'CANCELLED');

CREATE TYPE "PickupNotificationKind" AS ENUM ('INITIAL', 'REMINDER');

CREATE TYPE "PickupNotificationStatus" AS ENUM ('PENDING', 'PROCESSING', 'SENT', 'FAILED', 'UNREACHABLE', 'SKIPPED_TOO_LATE', 'CANCELLED');

-- AlterTable
ALTER TABLE "notification_setting"
  ADD COLUMN "pickupConfirmationEnabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "pickupInitialDaysBefore" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "pickupInitialTime" VARCHAR(5) NOT NULL DEFAULT '12:15',
  ADD COLUMN "pickupReminderEnabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "pickupReminderDaysBefore" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "pickupReminderTime" VARCHAR(5) NOT NULL DEFAULT '12:15',
  ADD COLUMN "pickupMinimumLeadMinutes" INTEGER NOT NULL DEFAULT 120;

ALTER TABLE "notification_subscriber"
  ADD COLUMN "receivePickupResponse" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "service_order_addon_usage"
  ADD COLUMN "isDelivery" BOOLEAN NOT NULL DEFAULT false;

-- Snapshot delivery meaning from either the entitlement product or the stored product id.
UPDATE "service_order_addon_usage" usage
SET "isDelivery" = true
WHERE EXISTS (
  SELECT 1
  FROM "member_entitlement" entitlement
  JOIN "package_product" product ON product."id" = entitlement."productId"
  WHERE entitlement."id" = usage."memberEntitlementId"
    AND product."isDelivery" = true
)
OR EXISTS (
  SELECT 1
  FROM "package_product" product
  WHERE product."id" = usage."productId"
    AND product."isDelivery" = true
);

DO $$
DECLARE
  remaining_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO remaining_count
  FROM "service_order_addon_usage"
  WHERE "isDelivery" = false;
  RAISE NOTICE 'service_order_addon_usage rows remaining isDelivery=false after backfill: %', remaining_count;
END $$;

ALTER TABLE "notification_setting"
  ADD CONSTRAINT "notification_setting_pickupInitialTime_check"
    CHECK ("pickupInitialTime" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  ADD CONSTRAINT "notification_setting_pickupReminderTime_check"
    CHECK ("pickupReminderTime" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  ADD CONSTRAINT "notification_setting_pickupInitialDaysBefore_check"
    CHECK ("pickupInitialDaysBefore" BETWEEN 0 AND 30),
  ADD CONSTRAINT "notification_setting_pickupReminderDaysBefore_check"
    CHECK ("pickupReminderDaysBefore" BETWEEN 0 AND 30),
  ADD CONSTRAINT "notification_setting_pickupMinimumLeadMinutes_check"
    CHECK ("pickupMinimumLeadMinutes" BETWEEN 0 AND 1440);

-- CreateTable
CREATE TABLE "pickup_confirmation" (
  "id" TEXT NOT NULL,
  "serviceOrderId" TEXT NOT NULL,
  "revision" INTEGER NOT NULL DEFAULT 1,
  "status" "PickupConfirmationStatus" NOT NULL DEFAULT 'ACTIVE',
  "response" "PickupConfirmationResponse",
  "respondedAt" TIMESTAMP(3),
  "responseCount" INTEGER NOT NULL DEFAULT 0,
  "dueAtSnapshot" TIMESTAMP(3),
  "closedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "pickup_confirmation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "pickup_confirmation_notification" (
  "id" TEXT NOT NULL,
  "confirmationId" TEXT NOT NULL,
  "revision" INTEGER NOT NULL,
  "kind" "PickupNotificationKind" NOT NULL,
  "recipientUserId" TEXT NOT NULL,
  "scheduledFor" TIMESTAMP(3) NOT NULL,
  "status" "PickupNotificationStatus" NOT NULL DEFAULT 'PENDING',
  "claimedAt" TIMESTAMP(3),
  "claimExpiresAt" TIMESTAMP(3),
  "sentAt" TIMESTAMP(3),
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "pickup_confirmation_notification_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "pickup_confirmation_response_event" (
  "id" TEXT NOT NULL,
  "confirmationId" TEXT NOT NULL,
  "revision" INTEGER NOT NULL,
  "webhookEventId" TEXT NOT NULL,
  "response" "PickupConfirmationResponse" NOT NULL,
  "respondedByLineId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "staffNotifiedAt" TIMESTAMP(3),
  "staffNotifyAttempts" INTEGER NOT NULL DEFAULT 0,
  "staffNotifyError" TEXT,

  CONSTRAINT "pickup_confirmation_response_event_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pickup_confirmation_serviceOrderId_key" ON "pickup_confirmation"("serviceOrderId");
CREATE UNIQUE INDEX "pickup_confirmation_notification_confirmationId_revision_kind_key" ON "pickup_confirmation_notification"("confirmationId", "revision", "kind");
CREATE INDEX "pickup_confirmation_notification_status_scheduledFor_idx" ON "pickup_confirmation_notification"("status", "scheduledFor");
CREATE INDEX "pickup_confirmation_notification_claimExpiresAt_idx" ON "pickup_confirmation_notification"("claimExpiresAt");
CREATE UNIQUE INDEX "pickup_confirmation_response_event_webhookEventId_key" ON "pickup_confirmation_response_event"("webhookEventId");
CREATE INDEX "pickup_confirmation_response_event_confirmationId_createdAt_idx" ON "pickup_confirmation_response_event"("confirmationId", "createdAt");
CREATE INDEX "pickup_confirmation_response_event_staffNotifiedAt_createdAt_idx" ON "pickup_confirmation_response_event"("staffNotifiedAt", "createdAt");

-- AddForeignKey
ALTER TABLE "pickup_confirmation" ADD CONSTRAINT "pickup_confirmation_serviceOrderId_fkey" FOREIGN KEY ("serviceOrderId") REFERENCES "service_order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pickup_confirmation_notification" ADD CONSTRAINT "pickup_confirmation_notification_confirmationId_fkey" FOREIGN KEY ("confirmationId") REFERENCES "pickup_confirmation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pickup_confirmation_response_event" ADD CONSTRAINT "pickup_confirmation_response_event_confirmationId_fkey" FOREIGN KEY ("confirmationId") REFERENCES "pickup_confirmation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
