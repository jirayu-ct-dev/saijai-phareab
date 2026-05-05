import {
  parseLineWebhookPayload,
  verifyLineWebhookSignature,
  type LineWebhookPayload,
} from "~~/server/utils/line-messaging";

export default defineEventHandler(async (event) => {
  const rawBody = await readRawBody(event, "utf8");

  if (!rawBody) {
    throw createError({ statusCode: 400, statusMessage: "Missing request body" });
  }

  const signature = getHeader(event, "x-line-signature");
  if (!signature) {
    throw createError({ statusCode: 400, statusMessage: "Missing x-line-signature header" });
  }

  const isValid = verifyLineWebhookSignature(rawBody, signature);
  if (!isValid) {
    throw createError({ statusCode: 401, statusMessage: "Invalid LINE webhook signature" });
  }

  let payload: LineWebhookPayload;
  try {
    payload = parseLineWebhookPayload(rawBody);
  } catch (error) {
    console.error("[POST /api/line/webhook] Invalid payload", error);
    throw createError({ statusCode: 400, statusMessage: "Invalid webhook payload" });
  }

  console.log("[POST /api/line/webhook] Received", payload.events.length, "events");

  return { ok: true };
});
