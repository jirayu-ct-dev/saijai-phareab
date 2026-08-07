-- Bring the migration history in sync with the current Prisma schema.

-- AlterTable
ALTER TABLE "service_order_addon_usage" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateTable
CREATE TABLE "line_rich_menu" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "richMenuId" TEXT NOT NULL,
    "imageUrl" TEXT,
    "imagePublicId" TEXT,
    "jsonContent" TEXT NOT NULL,
    "targetRole" TEXT,
    "aliasId" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "line_rich_menu_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "line_rich_menu_richMenuId_key" ON "line_rich_menu"("richMenuId");

-- CreateIndex
CREATE UNIQUE INDEX "line_rich_menu_aliasId_key" ON "line_rich_menu"("aliasId");
