import { describe, expect, it } from "vitest";
import { isDuplicateWebhookEvent } from "../../server/utils/webhookEventDedupe";

describe("LINE webhook event dedupe", () => {
  it("reports an event as duplicate only within the window", () => {
    const t0 = 1_000_000;
    expect(isDuplicateWebhookEvent("evt-1", t0)).toBe(false);
    expect(isDuplicateWebhookEvent("evt-1", t0 + 60_000)).toBe(true);

    const dayMs = 24 * 60 * 60 * 1000;
    expect(isDuplicateWebhookEvent("evt-1", t0 + dayMs + 1)).toBe(false);
  });

  it("tracks different event ids independently", () => {
    const t0 = 5_000_000;
    expect(isDuplicateWebhookEvent("evt-a", t0)).toBe(false);
    expect(isDuplicateWebhookEvent("evt-b", t0)).toBe(false);
    expect(isDuplicateWebhookEvent("evt-a", t0 + 1)).toBe(true);
    expect(isDuplicateWebhookEvent("evt-b", t0 + 1)).toBe(true);
  });
});
