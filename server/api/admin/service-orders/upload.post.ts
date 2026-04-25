import { uploadImageBufferToCloudinary } from "~~/server/utils/cloudinary";
import { requireRole } from "~~/server/utils/auth";
import { prisma } from "~~/server/utils/prisma";

export default defineEventHandler(async (event) => {
  const actor = requireRole(event, ["EMPLOYEE", "ADMIN"]);
  const parts = await readMultipartFormData(event);
  const file = parts?.find((part) => part.name === "file" && part.filename);

  if (!file?.data?.length) {
    throw createError({
      statusCode: 400,
      statusMessage: "กรุณาเลือกรูป",
    });
  }

  try {
    const uploaded = await uploadImageBufferToCloudinary(file.data, {
      folder: "saijai-phareab/admin-service-orders",
      publicId: `service-order-${Date.now()}`,
      resourceType: "image",
    });

    const image = await prisma.image.create({
      data: {
        userId: actor.id,
        assetId: uploaded.assetId,
        publicId: uploaded.publicId,
        url: uploaded.url,
        secureUrl: uploaded.secureUrl,
      },
    });

    return {
      id: image.id,
      secureUrl: image.secureUrl,
      url: image.url,
    };
  } catch (error) {
    console.error("[POST /api/admin/service-orders/upload]", error);
    throw createError({
      statusCode: 500,
      statusMessage: "Unable to upload service order image",
    });
  }
});
