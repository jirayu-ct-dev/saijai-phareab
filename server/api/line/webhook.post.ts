import {
  getMessageContent,
  parseLineWebhookPayload,
  replyMessage,
  startLoadingAnimation,
  verifyLineWebhookSignature,
  type LineWebhookEvent,
  type LineWebhookPayload,
} from "~~/server/utils/line-messaging";
import {
  findAppUserIdByLineUserId,
  uploadAndPersistLineImage,
} from "~~/server/utils/line-image";

const INVALID_REPLY_TOKEN = "00000000000000000000000000000000";

const isValidReplyToken = (replyToken?: string): replyToken is string => {
  return Boolean(replyToken && replyToken !== INVALID_REPLY_TOKEN);
};

const handleTextMessageEvent = async (event: LineWebhookEvent): Promise<void> => {
  const text = event.message?.text?.trim().toLowerCase();
  const replyToken = event.replyToken;

  if (!text || !isValidReplyToken(replyToken)) {
    return;
  }

  if (text !== "ping") {
    return;
  }

  const lineUserId = event.source?.type === "user" ? event.source.userId : null;
  if (lineUserId) {
    try {
      await startLoadingAnimation({
        chatId: lineUserId,
        loadingSeconds: 5,
      });
    } catch (error) {
      console.error("[LINE webhook] Failed to start loading animation", error);
    }
  }

  await replyMessage({
    replyToken,
    messages: [{ type: "text", text: "pong" }],
  });
};

const handleImageMessageEvent = async (event: LineWebhookEvent): Promise<void> => {
  const replyToken = event.replyToken;
  const messageId = event.message?.id;
  const lineUserId = event.source?.type === "user" ? event.source.userId ?? null : null;

  if (!isValidReplyToken(replyToken) || !messageId) {
    return;
  }

  const userId = await findAppUserIdByLineUserId(lineUserId);
  if (!userId) {
    console.warn("[LINE webhook] Skip image upload for unknown user", {
      webhookEventId: event.webhookEventId,
      lineUserId,
      messageId,
    });
    return;
  }

  try {
    await startLoadingAnimation({
      chatId: lineUserId as string,
      loadingSeconds: 5,
    });
  } catch (error) {
    console.error("[LINE webhook] Failed to start loading animation", error);
  }

  const image = await getMessageContent(messageId);
  const uploadedImage = await uploadAndPersistLineImage(userId, messageId, image);

  try {
    const response = await fetch(
      "https://connect.slip2go.com/api/verify-slip/qr-image-link/info",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.SLIP2GO_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          payload: {
            imageUrl: uploadedImage.secureUrl,
            checkCondition: {
              checkDuplicate: true,
              checkReceiver: [
                {
                  accountNameTH: "จิรายุ ชมทอง",
                  accountNameEN: "JIRAYU CHOMTHONG",
                },
              ],
            },
          },
        }),
      },
    );

    const data = await response.json();
    console.log("[LINE webhook] Check slip2go api image URL:", data);

    await replyMessage({
      replyToken,
      messages: [
        {
          type: "text",
          text: JSON.stringify(data),
        },
      ],
    });
  } catch (error) {
    console.log("[LINE webhook] Failed to upload check slip2go api image URL:", error);
  }
};

const handleLineWebhookEvent = async (event: LineWebhookEvent): Promise<void> => {
  if (event.type !== "message") {
    return;
  }

  if (event.message?.type === "text") {
    await handleTextMessageEvent(event);
    return;
  }

  if (event.message?.type === "image") {
    await handleImageMessageEvent(event);
  }
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

  try {
    for (const webhookEvent of payload.events) {
      await handleLineWebhookEvent(webhookEvent);
    }
  } catch (error) {
    console.error("[POST /api/line/webhook] Event handling error", error);
  }

  return { ok: true };
});
