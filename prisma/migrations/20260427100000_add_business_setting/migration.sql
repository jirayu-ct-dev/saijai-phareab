CREATE TABLE "business_setting" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "hangerPricePerUnit" DECIMAL(65,30) NOT NULL DEFAULT 10,
    "vatRate" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "vatIncluded" BOOLEAN NOT NULL DEFAULT false,
    "paymentNoPrefix" TEXT NOT NULL DEFAULT 'PAY-',
    "orderNoPrefix" TEXT NOT NULL DEFAULT 'ORD-',
    "minimumOrderAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "packageRefundDays" INTEGER NOT NULL DEFAULT 7,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "business_setting_pkey" PRIMARY KEY ("id")
);
