-- AlterTable
ALTER TABLE "package" ADD COLUMN     "bonusCredits" INTEGER DEFAULT 0;

-- CreateTable
CREATE TABLE "package_bundle" (
    "id" TEXT NOT NULL,
    "mainPackageId" TEXT NOT NULL,
    "addonPackageId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "package_bundle_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "package_bundle_mainPackageId_idx" ON "package_bundle"("mainPackageId");

-- CreateIndex
CREATE INDEX "package_bundle_addonPackageId_idx" ON "package_bundle"("addonPackageId");

-- CreateIndex
CREATE UNIQUE INDEX "package_bundle_mainPackageId_addonPackageId_key" ON "package_bundle"("mainPackageId", "addonPackageId");

-- AddForeignKey
ALTER TABLE "package_bundle" ADD CONSTRAINT "package_bundle_mainPackageId_fkey" FOREIGN KEY ("mainPackageId") REFERENCES "package"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "package_bundle" ADD CONSTRAINT "package_bundle_addonPackageId_fkey" FOREIGN KEY ("addonPackageId") REFERENCES "package"("id") ON DELETE CASCADE ON UPDATE CASCADE;
