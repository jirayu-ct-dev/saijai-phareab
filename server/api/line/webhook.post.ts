import { getShopIdentity } from "~~/server/utils/appSetting";
import {
  parseLineWebhookPayload,
  replyMessage,
  verifyLineWebhookSignature,
  type LineWebhookEvent,
  type LineWebhookPayload,
} from "~~/server/utils/line-messaging";
import { isDuplicateWebhookEvent } from "~~/server/utils/webhookEventDedupe";

const getShopName = async (): Promise<string> => {
  // DB-06 read cutover: identity from AppSetting with legacy fallback.
  const shop = await getShopIdentity();
  return shop.name.trim() || "ร้านซักผ้า";
};

const handleFollowEvent = async (ev: LineWebhookEvent): Promise<void> => {
  if (!ev.replyToken) return;
  const shopName = await getShopName();
  await replyMessage({
    replyToken: ev.replyToken,
    messages: [
      {
        type: "text",
        text: `สวัสดีค่ะ ยินดีต้อนรับสู่ ${shopName} นะคะ 🧺\nขอบคุณที่ติดตามเราค่ะ หากมีคำถามหรือต้องการสอบถามข้อมูลเพิ่มเติม ทักมาได้เลยนะคะ 😊`,
      },
    ],
  });
};

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

  for (const ev of payload.events) {
    // Reply tokens are single-use and short-lived, so a redelivered or
    // replayed event can only cause duplicate side effects — skip it.
    if (ev.deliveryContext?.isRedelivery) {
      console.log("[POST /api/line/webhook] Skipping redelivered event", ev.type);
      continue;
    }
    if (ev.webhookEventId && isDuplicateWebhookEvent(ev.webhookEventId)) {
      console.log("[POST /api/line/webhook] Skipping duplicate event", ev.type);
      continue;
    }
    if (ev.type === "follow") {
      void handleFollowEvent(ev).catch((err) =>
        console.error("[POST /api/line/webhook] follow handler error", err),
      );
    }
  }

  return { ok: true };
});
