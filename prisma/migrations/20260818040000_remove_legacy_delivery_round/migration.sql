-- Remove the legacy next-round pickup confirmation schema that previously
-- reached production through db push and is not represented in migration
-- history. IF EXISTS keeps fresh migration replays valid.
DROP TABLE IF EXISTS "delivery_round";

DROP TYPE IF EXISTS "DeliveryNotificationStatus";
DROP TYPE IF EXISTS "DeliveryRoundResponse";
