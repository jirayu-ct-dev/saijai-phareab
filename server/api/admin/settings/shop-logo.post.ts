import { uploadImageBufferToCloudinary } from "~~/server/utils/cloudinary";
import { validateImageUpload } from "~~/server/utils/imageUpload";
import { requireRole } from "~~/server/utils/auth";

export default defineEventHandler(async (event) => {
  requireRole(event, ["ADMIN"]);

  const parts = await readMultipartFormData(event);
  const file = parts?.find((part) => part.name === "file" && part.filename);

  if (!file?.data?.length) {
    throw createError({ statusCode: 400, statusMessage: "กรุณาเลือกไฟล์รูปโลโก้" });
  }
  const rejection = validateImageUpload(file);
  if (rejection) {
    throw createError(rejection);
  }

  try {
    const uploaded = await uploadImageBufferToCloudinary(file.data, {
      folder: "saijai-phareab/shop-logo",
      publicId: `shop-logo-${Date.now()}`,
      resourceType: "image",
    });

    return { secureUrl: uploaded.secureUrl };
  } catch {
    throw createError({ statusCode: 500, statusMessage: "ไม่สามารถอัปโหลดรูปโลโก้ได้" });
  }
});
