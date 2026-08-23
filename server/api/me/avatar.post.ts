import { uploadImageBufferToCloudinary } from "~~/server/utils/cloudinary";
import { validateImageUpload } from "~~/server/utils/imageUpload";
import { requireUser } from "~~/server/utils/auth";
import { createRateLimiter } from "~~/server/utils/rateLimit";

const avatarUploadLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 10,
});

export default defineEventHandler(async (event) => {
  const actor = requireUser(event);
  if (!avatarUploadLimiter.check(`avatar:${actor.id}`)) {
    throw createError({ statusCode: 429, statusMessage: "อัปโหลดรูปโปรไฟล์บ่อยเกินไป กรุณารอสักครู่" });
  }

  const parts = await readMultipartFormData(event);
  const file = parts?.find((part) => part.name === "file" && part.filename);

  if (!file?.data?.length) {
    throw createError({ statusCode: 400, statusMessage: "กรุณาเลือกไฟล์รูปโปรไฟล์" });
  }
  const rejection = validateImageUpload(file);
  if (rejection) {
    throw createError(rejection);
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
