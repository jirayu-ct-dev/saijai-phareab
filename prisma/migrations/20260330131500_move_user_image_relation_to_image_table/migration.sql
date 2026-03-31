ALTER TABLE "image"
ADD COLUMN "userId" TEXT;

CREATE INDEX "image_userId_idx" ON "image"("userId");

ALTER TABLE "image"
ADD CONSTRAINT "image_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "user"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

ALTER TABLE "user"
DROP CONSTRAINT "user_imageId_fkey";

ALTER TABLE "user"
DROP COLUMN "imageId";
