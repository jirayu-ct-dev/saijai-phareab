import { uploadImageBufferToCloudinary } from "~~/server/utils/cloudinary";
import { requireUser } from "~~/server/utils/auth";

export default defineEventHandler(async (event) => {
  const actor = requireUser(event);

  const parts = await readMultipartFormData(event);
  const file = parts?.find((part) => part.name === "file" && part.filename);

  if (!file?.data?.length) {
    throw createError({ statusCode: 400, statusMessage: "กรุณาเลือกไฟล์รูปโปรไฟล์" });
  }

  try {
    const uploaded = await uploadImageBufferToCloudinary(file.data, {
      folder: "saijai-phareab/avatars",
      publicId: `avatar-${actor.id}-${Date.now()}`,
      resourceType: "image",
    });

    return { secureUrl: uploaded.secureUrl };
  } catch {
    throw createError({ statusCode: 500, statusMessage: "ไม่สามารถอัปโหลดรูปโปรไฟล์ได้" });
  }
});
