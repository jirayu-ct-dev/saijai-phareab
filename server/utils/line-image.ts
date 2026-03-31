import { uploadImageBufferToCloudinary } from "~~/server/utils/cloudinary";
import { prisma } from "~~/server/utils/prisma";
import type { LineMessageContentResponse } from "~~/server/utils/line-messaging";

const LINE_PROVIDER_ID = "line";
const LINE_WEBHOOK_IMAGE_FOLDER = "saijai-phareab/line-webhook";

export type UploadedLineImage = {
  assetId: string | null;
  publicId: string | null;
  secureUrl: string;
  url: string | null;
};

export const findAppUserIdByLineUserId = async (lineUserId: string | null): Promise<string | null> => {
  if (!lineUserId) {
    return null;
  }

  const account = await prisma.account.findFirst({
    where: {
      providerId: LINE_PROVIDER_ID,
      accountId: lineUserId,
    },
    select: {
      userId: true,
    },
  });

  return account?.userId ?? null;
};

export const uploadLineImage = async (
  messageId: string,
  image: LineMessageContentResponse,
): Promise<UploadedLineImage> => {
  return uploadImageBufferToCloudinary(image.buffer, {
    folder: LINE_WEBHOOK_IMAGE_FOLDER,
    publicId: messageId,
    resourceType: "image",
  });
};

export const createLineImageRecord = async (
  userId: string | null,
  uploadedImage: UploadedLineImage,
) => {
  return prisma.image.create({
    data: {
      userId,
      assetId: uploadedImage.assetId,
      publicId: uploadedImage.publicId,
      url: uploadedImage.url,
      secureUrl: uploadedImage.secureUrl,
    },
  });
};

export const uploadAndPersistLineImage = async (
  userId: string | null,
  messageId: string,
  image: LineMessageContentResponse,
): Promise<UploadedLineImage> => {
  const uploadedImage = await uploadLineImage(messageId, image);
  await createLineImageRecord(userId, uploadedImage);
  return uploadedImage;
};
