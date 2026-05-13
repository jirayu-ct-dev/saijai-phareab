import { z } from "zod/v4";
import { prisma } from "~~/server/utils/prisma";
import { requireRole } from "~~/server/utils/auth";
import {
  HARD_DELETE_CONFIRM_TEXT,
  hardDeleteDeletedData,
  isDeletedDataType,
} from "~~/server/utils/deletedData";

const schema = z.object({
  type: z.string().refine(isDeletedDataType, "Invalid type"),
  confirmation: z.string(),
});

export default defineEventHandler(async (event) => {
  requireRole(event, ["ADMIN"]);
  const id = getRouterParam(event, "id");
  if (!id) throw createError({ statusCode: 400, statusMessage: "Missing id" });

  const body = await readValidatedBody(event, schema.parse);
  if (body.confirmation !== HARD_DELETE_CONFIRM_TEXT) {
    throw createError({ statusCode: 400, statusMessage: "ข้อความยืนยันไม่ถูกต้อง" });
  }

  try {
    await prisma.$transaction((tx) => hardDeleteDeletedData(tx, body.type, id));
    return { success: true };
  } catch (error) {
    if (error && typeof error === "object" && "statusCode" in error) throw error;
    console.error("[DELETE /api/admin/deleted/:id]", error);
    throw createError({ statusCode: 500, statusMessage: "ไม่สามารถลบถาวรได้" });
  }
});
