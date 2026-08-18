-- This permanently removes pickup-confirmation history and configuration.
DROP TABLE "pickup_confirmation_response_event";
DROP TABLE "pickup_confirmation_notification";
DROP TABLE "pickup_confirmation";

ALTER TABLE "notification_setting"
  DROP COLUMN "pickupConfirmationEnabled",
  DROP COLUMN "pickupInitialDaysBefore",
  DROP COLUMN "pickupInitialTime",
  DROP COLUMN "pickupReminderEnabled",
  DROP COLUMN "pickupReminderDaysBefore",
  DROP COLUMN "pickupReminderTime",
  DROP COLUMN "pickupMinimumLeadMinutes";

ALTER TABLE "notification_subscriber"
  DROP COLUMN "receivePickupResponse";

DROP TYPE "PickupConfirmationResponse";
DROP TYPE "PickupConfirmationStatus";
DROP TYPE "PickupNotificationKind";
DROP TYPE "PickupNotificationStatus";
