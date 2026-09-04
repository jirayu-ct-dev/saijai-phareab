import { requireRole } from "~~/server/utils/auth";
import { buildPaymentDocumentPayload } from "~~/server/utils/paymentDocument";
import { loadPaymentQrPresentation } from "~~/server/utils/paymentQrPresentation";

export default defineEventHandler(async (event) => {
  requireRole(event, ["EMPLOYEE", "ADMIN"]);

  const id = getRouterParam(event, "id");
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: "Missing payment id" });
  }

  const [payload, paymentQr] = await Promise.all([
    buildPaymentDocumentPayload(id),
    loadPaymentQrPresentation({ paymentId: id }),
  ]);

  if (!payload) {
    throw createError({ statusCode: 404, statusMessage: "Payment not found" });
  }

  return { ...payload, paymentQr };
});
