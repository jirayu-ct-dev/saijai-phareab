import { prisma } from "~~/server/utils/prisma";
import { requireRole } from "~~/server/utils/auth";
import { getDeletedDataItems, isDeletedDataType } from "~~/server/utils/deletedData";

export default defineEventHandler(async (event) => {
  requireRole(event, ["ADMIN"]);

  const query = getQuery(event);
  const typeParam = String(query.type || "all");
  const type = typeParam === "all" || isDeletedDataType(typeParam) ? typeParam : "all";
  const page = Math.max(1, Number(query.page || 1));
  const limit = Math.min(100, Math.max(1, Number(query.limit || 20)));
  const search = typeof query.search === "string" ? query.search : "";

  try {
    const result = await getDeletedDataItems(prisma, { type, search, page, limit });
    return {
      ...result,
      page,
      limit,
      pageCount: Math.max(1, Math.ceil(result.total / limit)),
    };
  } catch (error) {
    if (error && typeof error === "object" && "statusCode" in error) throw error;
    console.error("[GET /api/admin/deleted]", error);
    throw createError({ statusCode: 500, statusMessage: "ไม่สามารถโหลดข้อมูลที่ถูกลบได้" });
  }
});
