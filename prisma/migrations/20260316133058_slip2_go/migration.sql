/*
  Warnings:

  - A unique constraint covering the columns `[referenceNo]` on the table `payment_transaction` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "payment_transaction" DROP CONSTRAINT "payment_transaction_userPackageId_fkey";

-- DropIndex
DROP INDEX "payment_transaction_userPackageId_key";

-- AlterTable
ALTER TABLE "payment_transaction" ADD COLUMN     "orderId" TEXT,
ADD COLUMN     "receiverAccount" TEXT,
ADD COLUMN     "referenceNo" TEXT,
ADD COLUMN     "rejectionReason" TEXT,
ADD COLUMN     "senderBank" TEXT,
ADD COLUMN     "senderName" TEXT,
ADD COLUMN     "slipPayload" JSONB,
ALTER COLUMN "userPackageId" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "payment_transaction_referenceNo_key" ON "payment_transaction"("referenceNo");

-- CreateIndex
CREATE INDEX "payment_transaction_referenceNo_idx" ON "payment_transaction"("referenceNo");

-- AddForeignKey
ALTER TABLE "payment_transaction" ADD CONSTRAINT "payment_transaction_userPackageId_fkey" FOREIGN KEY ("userPackageId") REFERENCES "user_package"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_transaction" ADD CONSTRAINT "payment_transaction_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
