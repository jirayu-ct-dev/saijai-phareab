import { requireRole } from "~~/server/utils/auth";
import { buildPaymentDocumentPayload } from "~~/server/utils/paymentDocument";

export default defineEventHandler(async (event) => {
  requireRole(event, ["EMPLOYEE", "ADMIN"]);

  const id = getRouterParam(event, "id");
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: "Missing payment id" });
  }

  const payload = await buildPaymentDocumentPayload(id);

  if (!payload) {
    throw createError({ statusCode: 404, statusMessage: "Payment not found" });
  }

  if (payload.status !== "PAID") {
    throw createError({
      statusCode: 409,
      statusMessage: "ใบเสร็จจะออกได้หลังยืนยันการชำระเงินแล้วเท่านั้น",
      data: { redirectTo: "quotation", paymentId: id },
    });
  }

  return payload;
});
