-- AlterTable
ALTER TABLE "business_setting" ADD COLUMN     "printer_charset" TEXT NOT NULL DEFAULT 'THAI18',
ADD COLUMN     "printer_host" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "printer_paper_width" INTEGER NOT NULL DEFAULT 80,
ADD COLUMN     "printer_port" INTEGER NOT NULL DEFAULT 9100;
