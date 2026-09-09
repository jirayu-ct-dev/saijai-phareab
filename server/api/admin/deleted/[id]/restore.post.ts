import { z } from "zod/v4";
import { prisma } from "~~/server/utils/prisma";
import { requireRole } from "~~/server/utils/auth";
import { isDeletedDataType, restoreDeletedData } from "~~/server/utils/deletedData";
import { syncLineRichMenuForUser } from "~~/server/utils/line-richmenu";

const schema = z.object({
  type: z.string().refine(isDeletedDataType, "Invalid type"),
});

export default defineEventHandler(async (event) => {
  requireRole(event, ["ADMIN"]);
  const id = getRouterParam(event, "id");
  if (!id) throw createError({ statusCode: 400, statusMessage: "Missing id" });

  const body = await readValidatedBody(event, schema.parse);

  try {
    const richMenuSyncUserId = body.type === "user"
      ? id
      : body.type === "member_entitlement"
        ? (await prisma.memberEntitlement.findUnique({ where: { id }, select: { customerId: true } }))?.customerId
        : null;
    const restored = await prisma.$transaction((tx) => restoreDeletedData(tx, body.type, id));

    if (richMenuSyncUserId) {
      try {
        await syncLineRichMenuForUser(richMenuSyncUserId);
      } catch (error) {
        console.warn("[POST /api/admin/deleted/:id/restore] LINE rich menu sync failed", error);
      }
    }

    return { success: true, restored };
  } catch (error) {
    if (error && typeof error === "object" && "statusCode" in error) throw error;
    console.error("[POST /api/admin/deleted/:id/restore]", error);
    throw createError({ statusCode: 500, statusMessage: "ไม่สามารถกู้คืนข้อมูลได้" });
  }
});
