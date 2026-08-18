import { z } from "zod";
import { requireRole } from "~~/server/utils/auth";
import { createOfflineCustomer, isCustomerUniqueConflict, resolveOfflineCustomerConflict } from "~~/server/utils/customerAccount";
import { prisma } from "~~/server/utils/prisma";

const schema = z.object({
  name: z.string().trim().min(1).max(120),
  phoneNumber: z.string().trim().min(1).max(30),
  email: z.string().trim().email().max(320).optional().nullable(),
});

export default defineEventHandler(async (event) => {
  const actor = requireRole(event, ["EMPLOYEE", "ADMIN"]);
  const body = await readValidatedBody(event, schema.parse);

  try {
    return await prisma.$transaction((tx) => createOfflineCustomer(tx, {
      ...body,
      createdByStaffId: actor.id,
    }));
  } catch (error) {
    if (error && typeof error === "object" && "statusCode" in error) throw error;
    const duplicate = await resolveOfflineCustomerConflict(error, body);
    if (duplicate) {
      throw createError({
        statusCode: 409,
        statusMessage: "เบอร์โทรหรืออีเมลนี้มีบัญชีลูกค้าอยู่แล้ว",
        data: { customer: duplicate },
      });
    }
    if (isCustomerUniqueConflict(error)) {
      throw createError({ statusCode: 409, statusMessage: "เบอร์โทรหรืออีเมลนี้มีบัญชีอยู่แล้ว" });
    }
    console.error("[POST /api/admin/customers]", error);
    throw createError({ statusCode: 500, statusMessage: "ไม่สามารถสร้างลูกค้าได้" });
  }
});
