import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import {
  parseLineWebhookPayload,
  verifyLineWebhookSignature,
} from "../../server/utils/line-messaging";

describe("LINE webhook boundary", () => {
  const originalSecret = process.env.LINE_CHANNEL_SECRET;

  afterEach(() => {
    if (originalSecret === undefined) delete process.env.LINE_CHANNEL_SECRET;
    else process.env.LINE_CHANNEL_SECRET = originalSecret;
  });

  it("accepts the exact raw body signature and rejects a modified body", () => {
    process.env.LINE_CHANNEL_SECRET = "test-line-secret";
    const rawBody = JSON.stringify({ events: [] });
    const signature = createHmac("sha256", "test-line-secret").update(rawBody).digest("base64");

    expect(verifyLineWebhookSignature(rawBody, signature)).toBe(true);
    expect(verifyLineWebhookSignature(`${rawBody} `, signature)).toBe(false);
  });

  it("rejects payloads without an events array", () => {
    expect(() => parseLineWebhookPayload('{"events":[]}')).not.toThrow();
    expect(() => parseLineWebhookPayload('{"events":null}')).toThrow("Invalid LINE webhook payload");
  });
});
