import { requireRole } from "~~/server/utils/auth";
import { prisma } from "~~/server/utils/prisma";
import {
  createRichMenu,
  uploadRichMenuImage,
  setDefaultRichMenu,
  syncUserRichMenu,
  deleteRichMenu,
} from "~~/server/utils/line-messaging";
import { uploadImageBufferToCloudinary } from "~~/server/utils/cloudinary";

export default defineEventHandler(async (event) => {
  requireRole(event, ["ADMIN"]);

  const parts = await readMultipartFormData(event);
  if (!parts) {
    throw createError({ statusCode: 400, statusMessage: "กรุณากรอกข้อมูลให้ครบถ้วน" });
  }

  const namePart = parts.find((p) => p.name === "name");
  const jsonContentPart = parts.find((p) => p.name === "jsonContent");
  const targetRolePart = parts.find((p) => p.name === "targetRole");
  const isDefaultPart = parts.find((p) => p.name === "isDefault");
  const filePart = parts.find((p) => p.name === "file" && p.filename);

  if (!namePart || !namePart.data?.length) {
    throw createError({ statusCode: 400, statusMessage: "กรุณาระบุชื่อ Rich Menu" });
  }
  if (!jsonContentPart || !jsonContentPart.data?.length) {
    throw createError({ statusCode: 400, statusMessage: "กรุณาระบุ JSON Configuration" });
  }
  if (!filePart || !filePart.data?.length) {
    throw createError({ statusCode: 400, statusMessage: "กรุณาอัปโหลดรูปภาพ PNG" });
  }

  const name = namePart.data.toString("utf8").trim();
  const jsonContent = jsonContentPart.data.toString("utf8").trim();
  const targetRole = targetRolePart?.data?.length ? targetRolePart.data.toString("utf8").trim() : null;
  const isDefault = isDefaultPart?.data?.toString() === "true";

  // Validate JSON Structure
  let parsedJson: any;
  try {
    parsedJson = JSON.parse(jsonContent);
  } catch (e) {
    throw createError({ statusCode: 400, statusMessage: "รูปแบบ JSON ไม่ถูกต้อง" });
  }

  if (!parsedJson.size || typeof parsedJson.size.width !== "number" || typeof parsedJson.size.height !== "number") {
    throw createError({ statusCode: 400, statusMessage: "กรุณาระบุขนาด (size) เป็นตัวเลข" });
  }
  const w = parsedJson.size.width;
  const h = parsedJson.size.height;
  if (w < 800 || w > 2500 || h < 250 || h > 1686) {
    throw createError({
      statusCode: 400,
      statusMessage: "ขนาดของ Rich Menu ต้องอยู่ในเกณฑ์: กว้าง 800-2500px, สูง 250-1686px",
    });
  }
  if (!parsedJson.chatBarText) {
    throw createError({ statusCode: 400, statusMessage: "กรุณาระบุข้อความบนแถบแชท (chatBarText)" });
  }
  if (!Array.isArray(parsedJson.areas) || parsedJson.areas.length === 0) {
    throw createError({ statusCode: 400, statusMessage: "กรุณาระบุพื้นที่สัมผัส (areas) อย่างน้อย 1 ช่อง" });
  }
  for (const area of parsedJson.areas) {
    if (
      !area.bounds ||
      typeof area.bounds.x !== "number" ||
      typeof area.bounds.y !== "number" ||
      typeof area.bounds.width !== "number" ||
      typeof area.bounds.height !== "number"
    ) {
      throw createError({ statusCode: 400, statusMessage: "กรุณาระบุพิกัดพื้นที่สัมผัส (bounds) ให้ถูกต้องครบถ้วน" });
    }
    if (!area.action || !area.action.type) {
      throw createError({ statusCode: 400, statusMessage: "กรุณาระบุประเภทแอ็กชัน (action) ให้ครบถ้วน" });
    }
  }

  // Validate Image Format & Size
  if (filePart.data.length > 1024 * 1024) {
    throw createError({ statusCode: 400, statusMessage: "ขนาดไฟล์รูปภาพห้ามเกิน 1 MB" });
  }
  const isPng = filePart.type === "image/png" || filePart.filename.toLowerCase().endsWith(".png");
  if (!isPng) {
    throw createError({ statusCode: 400, statusMessage: "รูปภาพต้องเป็นไฟล์ประเภท PNG เท่านั้น" });
  }

  let richMenuId: string | null = null;
  try {
    // 1. Create on LINE
    console.log(`[LINE RichMenu] Creating on LINE...`);
    const lineResponse = await createRichMenu(parsedJson);
    richMenuId = lineResponse.richMenuId;

    // 2. Upload image to LINE
    console.log(`[LINE RichMenu] Uploading image content to LINE for richMenuId: ${richMenuId}`);
    await uploadRichMenuImage(richMenuId, filePart.data, "image/png");

    // 3. Upload to Cloudinary for permanent storage
    console.log(`[LINE RichMenu] Uploading image to Cloudinary...`);
    const cloudinaryResponse = await uploadImageBufferToCloudinary(filePart.data, {
      folder: "saijai-phareab/richmenu",
      publicId: `richmenu-${richMenuId}`,
      resourceType: "image",
    });

    // 4. Save to Database
    const newRichMenu = await prisma.$transaction(async (tx) => {
      // If we are setting this one as default, reset others
      if (isDefault) {
        await tx.lineRichMenu.updateMany({
          data: { isDefault: false },
        });
      }

      // If we are mapping this to a role, remove role mapping from other rich menus
      if (targetRole) {
        await tx.lineRichMenu.updateMany({
          where: { targetRole },
          data: { targetRole: null },
        });
      }

      return await tx.lineRichMenu.create({
        data: {
          name,
          richMenuId,
          imageUrl: cloudinaryResponse.secureUrl,
          imagePublicId: cloudinaryResponse.publicId,
          jsonContent: JSON.stringify(parsedJson),
          targetRole,
          isDefault,
        },
      });
    });

    // 5. If setting default, apply default status on LINE
    if (isDefault) {
      await setDefaultRichMenu(richMenuId);
    }

    // 6. Asynchronously sync all matching users in background
    void (async () => {
      try {
        console.log(`[LINE RichMenu] Starting background sync for role: ${targetRole || "default"}`);
        let userQuery: any = { deletedAt: null, isActive: true };

        if (targetRole === "ADMIN" || targetRole === "EMPLOYEE") {
          userQuery.role = { in: ["ADMIN", "EMPLOYEE"] };
        } else if (targetRole === "USER") {
          userQuery.role = "USER";
          userQuery.memberEntitlements = {
            none: {
              status: "ACTIVE",
            },
          };
        } else if (targetRole === "MEMBER") {
          userQuery.role = "USER";
          userQuery.memberEntitlements = {
            some: {
              status: "ACTIVE",
            },
          };
        }

        const users = await prisma.user.findMany({
          where: userQuery,
          select: { id: true },
        });

        console.log(`[LINE RichMenu] Syncing ${users.length} users...`);
        for (const user of users) {
          await syncUserRichMenu(user.id);
        }
        console.log(`[LINE RichMenu] Background sync complete!`);
      } catch (err) {
        console.error(`[LINE RichMenu] Background sync error:`, err);
      }
    })();

    return newRichMenu;
  } catch (error: any) {
    if (richMenuId) {
      console.error(`[LINE RichMenu] DB/Cloudinary upload failed. Rolling back LINE Rich Menu ${richMenuId}...`);
      await deleteRichMenu(richMenuId).catch((err) => {
        console.error(`[LINE RichMenu Rollback Error] Failed to delete Rich Menu ${richMenuId} on LINE OA:`, err?.message || err);
      });
    }
    console.error(`[LINE RichMenu Create API] Failed:`, error);
    throw createError({
      statusCode: 500,
      statusMessage: error?.message || "เกิดข้อผิดพลาดในการสร้าง Rich Menu บน LINE",
    });
  }
});
