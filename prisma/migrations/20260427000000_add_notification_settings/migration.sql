-- AlterTable
ALTER TABLE "user" ADD COLUMN "lineNotifyEnabled" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "notification_setting" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "notifyCustomerOnReceived" BOOLEAN NOT NULL DEFAULT true,
    "notifyCustomerOnProcessing" BOOLEAN NOT NULL DEFAULT true,
    "notifyCustomerOnDelivering" BOOLEAN NOT NULL DEFAULT true,
    "notifyCustomerOnCompleted" BOOLEAN NOT NULL DEFAULT true,
    "notifyCustomerOnCancelled" BOOLEAN NOT NULL DEFAULT true,
    "notifyCustomerReceipt" BOOLEAN NOT NULL DEFAULT true,
    "notifyStaffOnNewOrder" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_setting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_subscriber" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "receiveNewOrder" BOOLEAN NOT NULL DEFAULT true,
    "receiveStatusChange" BOOLEAN NOT NULL DEFAULT true,
    "receiveReceipt" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_subscriber_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "notification_subscriber_userId_key" ON "notification_subscriber"("userId");

-- AddForeignKey
ALTER TABLE "notification_subscriber" ADD CONSTRAINT "notification_subscriber_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
