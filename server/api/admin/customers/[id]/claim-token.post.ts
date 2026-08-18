import { requireRole } from "~~/server/utils/auth";
import { issueCustomerClaimToken } from "~~/server/utils/customerAccount";
import { prisma } from "~~/server/utils/prisma";
import { Prisma } from "~~/app/generated/prisma/client";

export default defineEventHandler(async (event) => {
  const actor = requireRole(event, ["ADMIN"]);
  const id = getRouterParam(event, "id");
  if (!id) throw createError({ statusCode: 400, statusMessage: "ไม่พบรหัสลูกค้า" });

  try {
    return await prisma.$transaction(async (tx) => {
      const customer = await tx.user.findFirst({
        where: { id, deletedAt: null, role: "USER" },
        select: { id: true, customerAccountStatus: true },
      });
      if (!customer) throw createError({ statusCode: 404, statusMessage: "ไม่พบลูกค้า" });
      if (customer.customerAccountStatus !== "OFFLINE") {
        throw createError({ statusCode: 409, statusMessage: "บัญชีนี้เปิดใช้งานแล้ว" });
      }

      const claim = await issueCustomerClaimToken(tx, { userId: id, createdById: actor.id });
      return { activationToken: claim.token, expiresAt: claim.expiresAt.toISOString() };
    });
  } catch (error) {
    if (error && typeof error === "object" && "statusCode" in error) throw error;
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw createError({ statusCode: 409, statusMessage: "มีการออกรหัสเปิดใช้งานพร้อมกัน กรุณาลองใหม่" });
    }
    console.error("[POST /api/admin/customers/:id/claim-token]", error);
    throw createError({ statusCode: 500, statusMessage: "ไม่สามารถออกรหัสเปิดใช้งานได้" });
  }
});
