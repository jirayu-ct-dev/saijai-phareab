/*
  Warnings:

  - You are about to drop the column `receiverAccount` on the `payment_transaction` table. All the data in the column will be lost.
  - You are about to drop the column `senderBank` on the `payment_transaction` table. All the data in the column will be lost.
  - You are about to drop the column `senderName` on the `payment_transaction` table. All the data in the column will be lost.
  - You are about to drop the column `slipPayload` on the `payment_transaction` table. All the data in the column will be lost.
  - Added the required column `paymentMethod` to the `payment_transaction` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'TRANSFER');

-- DropIndex
DROP INDEX "payment_transaction_referenceNo_key";

-- AlterTable
ALTER TABLE "payment_transaction" DROP COLUMN "receiverAccount",
DROP COLUMN "senderBank",
DROP COLUMN "senderName",
DROP COLUMN "slipPayload",
ADD COLUMN     "metadata" JSONB,
ADD COLUMN     "note" TEXT,
ADD COLUMN     "paidAt" TIMESTAMP(3),
ADD COLUMN     "paymentMethod" "PaymentMethod" NOT NULL;

-- CreateIndex
CREATE INDEX "payment_transaction_paymentMethod_createdAt_idx" ON "payment_transaction"("paymentMethod", "createdAt");
