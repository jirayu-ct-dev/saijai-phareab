import { prisma } from "~~/server/utils/prisma";
import {
  parseLineWebhookPayload,
  replyMessage,
  verifyLineWebhookSignature,
  type LineWebhookEvent,
  type LineWebhookPayload,
} from "~~/server/utils/line-messaging";
import { parsePickupConfirmationPostback } from "~~/shared/utils/pickupConfirmationPostback";
import {
  notifyPickupResponseEvent,
  pickupResponseLabels,
  recordPickupResponse,
} from "~~/server/utils/pickupConfirmationResponse";

const getShopName = async (): Promise<string> => {
  const shop = await prisma.shopSetting.findUnique({ where: { id: "singleton" } });
  return shop?.name?.trim() || "ร้านซักผ้า";
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

const replyText = async (ev: LineWebhookEvent, text: string): Promise<void> => {
  if (!ev.replyToken) return;
  await replyMessage({ replyToken: ev.replyToken, messages: [{ type: "text", text }] });
};

const handlePickupConfirmationPostback = async (ev: LineWebhookEvent): Promise<void> => {
  const parsed = parsePickupConfirmationPostback(ev.postback?.data || "");
  if (!parsed) {
    await replyText(ev, "คำตอบนี้ไม่ถูกต้อง กรุณาใช้ปุ่มจากข้อความล่าสุดอีกครั้งค่ะ/ครับ");
    return;
  }
  const lineUserId = ev.source?.type === "user" ? ev.source.userId : undefined;
  if (!lineUserId || !ev.webhookEventId) {
    await replyText(ev, "ไม่สามารถยืนยันตัวตนจากข้อความนี้ได้ กรุณาติดต่อร้านค่ะ/ครับ");
    return;
  }

  const result = await recordPickupResponse({
    webhookEventId: ev.webhookEventId,
    confirmationId: parsed.confirmationId,
    revision: parsed.revision,
    response: parsed.response,
    respondedByLineId: lineUserId,
  });
  if (!result.ok) {
    const text = result.reason === "UNAUTHORIZED"
      ? "บัญชี LINE นี้ไม่ใช่เจ้าของออเดอร์ค่ะ/ครับ"
      : result.reason === "STALE"
        ? "ข้อความนี้เป็นรอบเก่า กรุณาใช้ปุ่มจากข้อความล่าสุดค่ะ/ครับ"
        : "รายการนี้ปิดรับคำตอบแล้ว กรุณาติดต่อร้านค่ะ/ครับ";
    await replyText(ev, text);
    return;
  }

  await notifyPickupResponseEvent(result.eventId);
  const prefix = result.duplicate
    ? "ระบบได้รับคำตอบนี้แล้ว"
    : result.responseCount > 1 ? "แก้ไขคำตอบเรียบร้อยแล้ว" : "บันทึกคำตอบเรียบร้อยแล้ว";
  await replyText(ev, `${prefix}\n${pickupResponseLabels[parsed.response]}\nขอบคุณค่ะ/ครับ`);
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
    if (ev.type === "follow") {
      void handleFollowEvent(ev).catch((err) =>
        console.error("[POST /api/line/webhook] follow handler error", err),
      );
    }
    if (ev.type === "postback" && ev.postback?.data?.startsWith("action=pickup_confirmation")) {
      await handlePickupConfirmationPostback(ev);
    }
  }

  return { ok: true };
});
