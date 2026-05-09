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
      statusMessage: "กรุณาเลือกไฟล์สลิป",
    });
  }

  const mime = file.type || "";
  if (!/^image\/(jpe?g|png|webp)$/i.test(mime)) {
    throw createError({ statusCode: 400, statusMessage: "รองรับเฉพาะไฟล์ภาพ JPEG / PNG / WebP" });
  }
  if (file.data.length > 5 * 1024 * 1024) {
    throw createError({ statusCode: 413, statusMessage: "ไฟล์เกินขนาดสูงสุด 5MB" });
  }

  try {
    const uploaded = await uploadImageBufferToCloudinary(file.data, {
      folder: "saijai-phareab/admin-payment-slips",
      publicId: `payment-slip-${Date.now()}`,
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
    console.error("[POST /api/admin/payments/upload]", error);
    throw createError({
      statusCode: 500,
      statusMessage: "Unable to upload slip",
    });
  }
});
