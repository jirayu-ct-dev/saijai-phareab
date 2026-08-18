import { z } from "zod";
import { requireRole } from "~~/server/utils/auth";
import { customerSummarySelect, toSafeCustomerSummary } from "~~/server/utils/customerAccount";
import { prisma } from "~~/server/utils/prisma";
import { normalizeThaiPhoneNumber } from "~~/shared/utils/phone";

const schema = z.object({ phoneNumber: z.string().trim().min(1).max(30) });

export default defineEventHandler(async (event) => {
  requireRole(event, ["EMPLOYEE", "ADMIN"]);
  const { phoneNumber } = await getValidatedQuery(event, schema.parse);
  const normalizedPhoneNumber = normalizeThaiPhoneNumber(phoneNumber);
  if (!normalizedPhoneNumber) {
    throw createError({ statusCode: 400, statusMessage: "เบอร์โทรศัพท์ไม่ถูกต้อง" });
  }

  const customer = await prisma.user.findFirst({
    where: { normalizedPhoneNumber, deletedAt: null },
    select: customerSummarySelect,
  });
  return {
    exists: Boolean(customer),
    customer: customer?.role === "USER" ? toSafeCustomerSummary(customer) : null,
  };
});
