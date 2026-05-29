import { prisma } from "~~/server/utils/prisma";
import { requireRole } from "~~/server/utils/auth";
import { uploadImageBufferToCloudinary } from "~~/server/utils/cloudinary";
import {
  createRichMenu,
  uploadRichMenuImage,
  setDefaultRichMenu,
  syncUserRichMenu,
} from "~~/server/utils/line-messaging";

export default defineEventHandler(async (event) => {
  requireRole(event, ["ADMIN"]);

  const parts = await readMultipartFormData(event);
  if (!parts) {
    throw createError({ statusCode: 400, statusMessage: "ไม่พบข้อมูลฟอร์ม" });
  }

  const getString = (name: string): string | undefined =>
    parts.find((p) => p.name === name && !p.filename)?.data?.toString("utf-8");

  const name = getString("name");
  const jsonContent = getString("jsonContent");
  const targetRole = getString("targetRole") || null;
  const isDefaultStr = getString("isDefault") ?? "false";
  const isDefault = isDefaultStr === "true";
  const file = parts.find((p) => p.name === "file" && p.filename);

  if (!name?.trim()) {
    throw createError({ statusCode: 400, statusMessage: "กรุณาระบุชื่อ Rich Menu" });
  }

  if (!jsonContent?.trim()) {
    throw createError({ statusCode: 400, statusMessage: "กรุณาระบุ JSON config" });
  }

  let jsonConfig: Record<string, unknown>;
  try {
    jsonConfig = JSON.parse(jsonContent);
  } catch {
    throw createError({ statusCode: 400, statusMessage: "JSON config ไม่ถูกต้อง" });
  }

  if (!file?.data?.length) {
    throw createError({ statusCode: 400, statusMessage: "กรุณาเลือกไฟล์รูป Rich Menu" });
  }

  const contentType = file.type ?? "image/png";

  try {
    // 1. Create rich menu on LINE API
    const { richMenuId } = await createRichMenu(jsonConfig);

    // 2. Upload image to Cloudinary for storage
    const uploaded = await uploadImageBufferToCloudinary(file.data, {
      folder: "saijai-phareab/richmenu",
      publicId: `richmenu-${richMenuId}`,
      resourceType: "image",
    });

    // 3. Upload image to LINE
    await uploadRichMenuImage(richMenuId, file.data, contentType);

    // 4. If isDefault, set as default on LINE and clear other menus' isDefault in DB
    if (isDefault) {
      await setDefaultRichMenu(richMenuId);
      await prisma.lineRichMenu.updateMany({
        where: {},
        data: { isDefault: false },
      });
    }

    // 5. Save to DB
    const richMenu = await prisma.lineRichMenu.create({
      data: {
        name: name.trim(),
        richMenuId,
        imageUrl: uploaded.secureUrl,
        imagePublicId: uploaded.publicId,
        jsonContent,
        targetRole,
        isDefault,
      },
    });

    // 6. Background sync for users with the targetRole (don't await)
    if (targetRole) {
      prisma.account
        .findMany({
          where: { providerId: "line" },
          select: { userId: true },
        })
        .then((accounts) => {
          for (const acc of accounts) {
            syncUserRichMenu(acc.userId).catch(() => {});
          }
        })
        .catch(() => {});
    }

    return richMenu;
  } catch (error) {
    console.error("[POST /api/admin/settings/richmenu]", error);
    throw createError({
      statusCode: 500,
      statusMessage: "ไม่สามารถสร้าง Rich Menu ได้",
    });
  }
});
