import { createHmac, timingSafeEqual } from "node:crypto";
import { prisma } from "./prisma";
import { hasActiveMemberPackage } from "./auth";

type LineMessagingTokenResponse = {
  access_token: string;
  expires_in: number;
  token_type: string;
};

type LineTextMessage = {
  type: "text";
  text: string;
};

type LineImageMessage = {
  type: "image";
  originalContentUrl: string;
  previewImageUrl: string;
};

type LineFlexMessage = {
  type: "flex";
  altText: string;
  contents: Record<string, unknown>;
};

export type LineMessage = LineTextMessage | LineImageMessage | LineFlexMessage;

type LineReplyMessageRequest = {
  replyToken: string;
  messages: LineMessage[];
  notificationDisabled?: boolean;
};

type LinePushMessageRequest = {
  to: string;
  messages: LineMessage[];
  notificationDisabled?: boolean;
};

type LineLoadingAnimationRequest = {
  chatId: string;
  loadingSeconds: number;
};

type LineWebhookSource = {
  type: "user" | "group" | "room";
  userId?: string;
  groupId?: string;
  roomId?: string;
};

type LineWebhookMessage = {
  id: string;
  type: string;
  text?: string;
  quoteToken?: string;
  contentProvider?: {
    type: "line" | "external";
    originalContentUrl?: string;
    previewImageUrl?: string;
  };
};

export type LineWebhookEvent = {
  type: string;
  mode?: "active" | "standby";
  timestamp?: number;
  webhookEventId?: string;
  deliveryContext?: {
    isRedelivery: boolean;
  };
  source?: LineWebhookSource;
  replyToken?: string;
  message?: LineWebhookMessage;
};

export type LineWebhookPayload = {
  destination?: string;
  events: LineWebhookEvent[];
};

type CachedAccessToken = {
  token: string;
  expiresAt: number;
};

export type LineMessageContentResponse = {
  contentType: string | null;
  contentLength: number | null;
  buffer: Buffer;
};

const TOKEN_EXPIRY_BUFFER_SECONDS = 60;
let cachedStatelessAccessToken: CachedAccessToken | null = null;

const trimTrailingSlash = (value: string): string => value.replace(/\/+$/, "");

const getRequiredEnv = (name: string): string => {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
};

const getLineMessagingApiBaseUrl = (): string => {
  const configured = process.env.LINE_MESSAGING_API?.trim();
  return trimTrailingSlash(configured || "https://api.line.me/v2/bot");
};

const getLineDataApiBaseUrl = (): string => {
  const configured = process.env.LINE_MESSAGING_DATA_API?.trim();
  return trimTrailingSlash(configured || "https://api-data.line.me/v2/bot");
};

const getLineMessagingOauthIssueTokenV3Url = (): string => {
  const configured = process.env.LINE_MESSAGING_OAUTH_ISSUE_TOKENV3?.trim();
  return configured || "https://api.line.me/oauth2/v3/token";
};

const getLineChannelId = (): string => getRequiredEnv("LINE_CHANNEL_ID");

const getLineChannelSecret = (): string => getRequiredEnv("LINE_CHANNEL_SECRET");

const getConfiguredChannelAccessToken = (): string | null => {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN?.trim();
  return token || null;
};

const isCachedTokenValid = (cached: CachedAccessToken | null): cached is CachedAccessToken => {
  if (!cached) return false;
  return Date.now() < cached.expiresAt;
};

const getMessagingApiUrl = (path: string): string => {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${getLineMessagingApiBaseUrl()}${normalizedPath}`;
};

const getMessagingDataApiUrl = (path: string): string => {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${getLineDataApiBaseUrl()}${normalizedPath}`;
};

export const issueStatelessChannelAccessToken = async (): Promise<string> => {
  if (isCachedTokenValid(cachedStatelessAccessToken)) {
    return cachedStatelessAccessToken.token;
  }

  const params = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: getLineChannelId(),
    client_secret: getLineChannelSecret(),
  });

  const response = await $fetch<LineMessagingTokenResponse>(getLineMessagingOauthIssueTokenV3Url(), {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params,
  });

  if (!response?.access_token) {
    throw new Error("LINE OAuth token response missing access_token");
  }

  const expiresIn = Number(response.expires_in || 0);
  const safeExpiresInSeconds = Math.max(0, expiresIn - TOKEN_EXPIRY_BUFFER_SECONDS);

  cachedStatelessAccessToken = {
    token: response.access_token,
    expiresAt: Date.now() + safeExpiresInSeconds * 1000,
  };

  return response.access_token;
};

const getLineAccessToken = async (): Promise<string> => {
  const staticToken = getConfiguredChannelAccessToken();

  try {
    return await issueStatelessChannelAccessToken();
  } catch (error) {
    if (staticToken) {
      console.warn("[LINE messaging] Fallback to LINE_CHANNEL_ACCESS_TOKEN", error);
      return staticToken;
    }

    throw error;
  }
};

const callLineMessagingApi = async (
  path: string,
  body: Record<string, unknown>,
): Promise<unknown> => {
  const accessToken = await getLineAccessToken();

  return $fetch(getMessagingApiUrl(path), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body,
  });
};

export const replyMessage = async (payload: LineReplyMessageRequest): Promise<void> => {
  await callLineMessagingApi("/message/reply", payload);
};

export const pushMessage = async (payload: LinePushMessageRequest): Promise<void> => {
  await callLineMessagingApi("/message/push", payload);
};

export const startLoadingAnimation = async (payload: LineLoadingAnimationRequest): Promise<void> => {
  await callLineMessagingApi("/chat/loading/start", payload);
};

export const getMessageContent = async (messageId: string): Promise<LineMessageContentResponse> => {
  const accessToken = await getLineAccessToken();
  const response = await fetch(getMessagingDataApiUrl(`/message/${messageId}/content`), {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`LINE get content failed with status ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();

  return {
    contentType: response.headers.get("content-type"),
    contentLength: response.headers.get("content-length")
      ? Number(response.headers.get("content-length"))
      : null,
    buffer: Buffer.from(arrayBuffer),
  };
};

export function verifyLineWebhookSignature(rawBody: string, signature: string): boolean {
  const secret = getLineChannelSecret();

  const digest = createHmac("sha256", secret).update(rawBody).digest("base64");
  const digestBuffer = Buffer.from(digest, "utf8");
  const signatureBuffer = Buffer.from(signature, "utf8");

  if (digestBuffer.length !== signatureBuffer.length) {
    return false;
  }

  return timingSafeEqual(digestBuffer, signatureBuffer);
}

export function parseLineWebhookPayload(rawBody: string): LineWebhookPayload {
  const payload = JSON.parse(rawBody) as LineWebhookPayload;

  if (!payload || !Array.isArray(payload.events)) {
    throw new Error("Invalid LINE webhook payload");
  }

  return payload;
}

// --- LINE Rich Menu APIs ---

export async function createRichMenu(richMenuConfig: Record<string, unknown>): Promise<{ richMenuId: string }> {
  const response = await callLineMessagingApi("/richmenu", richMenuConfig);
  return response as { richMenuId: string };
}

export const uploadRichMenuImage = async (
  richMenuId: string,
  buffer: Buffer,
  contentType: string,
): Promise<void> => {
  const accessToken = await getLineAccessToken();
  const url = getMessagingDataApiUrl(`/richmenu/${richMenuId}/content`);

  await $fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": contentType,
    },
    body: buffer,
  });
};

export const deleteRichMenu = async (richMenuId: string): Promise<void> => {
  const accessToken = await getLineAccessToken();
  const url = getMessagingApiUrl(`/richmenu/${richMenuId}`);

  await $fetch(url, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
};

export const linkRichMenuToUser = async (userId: string, richMenuId: string): Promise<void> => {
  const accessToken = await getLineAccessToken();
  const url = getMessagingApiUrl(`/user/${userId}/richmenu/${richMenuId}`);

  await $fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
};

export const unlinkRichMenuFromUser = async (userId: string): Promise<void> => {
  const accessToken = await getLineAccessToken();
  const url = getMessagingApiUrl(`/user/${userId}/richmenu`);

  await $fetch(url, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  }).catch((err) => {
    // Ignore 404/not found when unlinking
    console.warn(`[LINE RichMenu] Unlink failed for user ${userId}:`, err?.message || err);
  });
};

export const setDefaultRichMenu = async (richMenuId: string): Promise<void> => {
  const accessToken = await getLineAccessToken();
  const url = getMessagingApiUrl(`/user/all/richmenu/${richMenuId}`);

  await $fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
};

export const cancelDefaultRichMenu = async (): Promise<void> => {
  const accessToken = await getLineAccessToken();
  const url = getMessagingApiUrl(`/user/all/richmenu`);

  await $fetch(url, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
};

export const createRichMenuAlias = async (aliasId: string, richMenuId: string): Promise<void> => {
  await callLineMessagingApi("/richmenu/alias", {
    richMenuAliasId: aliasId,
    richMenuId,
  });
};

export const deleteRichMenuAlias = async (aliasId: string): Promise<void> => {
  const accessToken = await getLineAccessToken();
  const url = getMessagingApiUrl(`/richmenu/alias/${aliasId}`);

  await $fetch(url, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
};

export const listRichMenuAliases = async (): Promise<{ aliases: Array<{ richMenuAliasId: string; richMenuId: string }> }> => {
  const accessToken = await getLineAccessToken();
  const url = getMessagingApiUrl("/richmenu/alias/list");

  const response = await $fetch<{ aliases: Array<{ richMenuAliasId: string; richMenuId: string }> }>(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  return response;
};

// Automatic role-based sync helper
export const syncUserRichMenu = async (userId: string): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId, deletedAt: null },
      select: { id: true, role: true, isActive: true },
    });

    if (!user || !user.isActive) {
      // If user is deleted or inactive, we could unlink their rich menu
      const lineAccount = await prisma.account.findFirst({
        where: { userId, providerId: "line" },
        select: { accountId: true },
      });
      if (lineAccount) {
        await unlinkRichMenuFromUser(lineAccount.accountId).catch(() => {});
      }
      return;
    }

    const lineAccount = await prisma.account.findFirst({
      where: { userId, providerId: "line" },
      select: { accountId: true },
    });

    if (!lineAccount?.accountId) {
      return; // Not a LINE user, nothing to sync
    }

    const lineUserId = lineAccount.accountId;

    // Determine effective role
    let effectiveRole = "USER";
    if (user.role === "ADMIN") {
      effectiveRole = "ADMIN";
    } else if (user.role === "EMPLOYEE") {
      effectiveRole = "EMPLOYEE";
    } else {
      // Check if they are a MEMBER (active entitlement)
      const isMember = await hasActiveMemberPackage(user.id);
      if (isMember) {
        effectiveRole = "MEMBER";
      }
    }

    // Find rich menu matching this effective role
    let richMenu = await prisma.lineRichMenu.findFirst({
      where: { targetRole: effectiveRole },
    });

    // Fallback between ADMIN and EMPLOYEE since they share the same rich menu
    if (!richMenu && effectiveRole === "EMPLOYEE") {
      richMenu = await prisma.lineRichMenu.findFirst({
        where: { targetRole: "ADMIN" },
      });
    }
    if (!richMenu && effectiveRole === "ADMIN") {
      richMenu = await prisma.lineRichMenu.findFirst({
        where: { targetRole: "EMPLOYEE" },
      });
    }

    // Fallback to default rich menu if none is found for the role
    if (!richMenu) {
      richMenu = await prisma.lineRichMenu.findFirst({
        where: { isDefault: true },
      });
    }

    if (richMenu) {
      await linkRichMenuToUser(lineUserId, richMenu.richMenuId);
      console.log(`[LINE RichMenu] Linked richMenuId ${richMenu.richMenuId} to user ${userId} (effectiveRole: ${effectiveRole})`);
    } else {
      await unlinkRichMenuFromUser(lineUserId).catch(() => {});
      console.log(`[LINE RichMenu] Unlinked richMenu from user ${userId} (no menu configured)`);
    }
  } catch (error) {
    console.error(`[LINE RichMenu] Failed to sync user ${userId}:`, error);
  }
};


