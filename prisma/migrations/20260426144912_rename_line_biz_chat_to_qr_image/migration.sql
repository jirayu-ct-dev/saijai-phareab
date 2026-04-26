/*
  Warnings:

  - You are about to drop the column `lineBizChatUrl` on the `shop_setting` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "shop_setting" DROP COLUMN "lineBizChatUrl",
ADD COLUMN     "lineQrImageUrl" TEXT;
