import { z } from "zod/v4";
import { prisma } from "~~/server/utils/prisma";
import { requireRole } from "~~/server/utils/auth";
import { isDeletedDataType, restoreDeletedData } from "~~/server/utils/deletedData";

const schema = z.object({
  type: z.string().refine(isDeletedDataType, "Invalid type"),
});

export default defineEventHandler(async (event) => {
  requireRole(event, ["ADMIN"]);
  const id = getRouterParam(event, "id");
  if (!id) throw createError({ statusCode: 400, statusMessage: "Missing id" });

  const body = await readValidatedBody(event, schema.parse);

  try {
    const restored = await prisma.$transaction((tx) => restoreDeletedData(tx, body.type, id));
    return { success: true, restored };
  } catch (error) {
    if (error && typeof error === "object" && "statusCode" in error) throw error;
    console.error("[POST /api/admin/deleted/:id/restore]", error);
    throw createError({ statusCode: 500, statusMessage: "ไม่สามารถกู้คืนข้อมูลได้" });
  }
});
