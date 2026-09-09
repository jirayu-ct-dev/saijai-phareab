import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("LINE Rich Menu API requests", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.LINE_CHANNEL_ACCESS_TOKEN = "test-token";
    delete process.env.LINE_CHANNEL_ID;
    delete process.env.LINE_CHANNEL_SECRET;
    process.env.LINE_MESSAGING_API = "https://api.line.test/v2/bot";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.LINE_CHANNEL_ACCESS_TOKEN;
    delete process.env.LINE_MESSAGING_API;
  });

  it("links a menu and reads the linked ID through the configured Messaging API base", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ richMenuId: "richmenu-employee" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const { getRichMenuForUser, linkRichMenuToUser } = await import("../../server/utils/line-messaging");
    await expect(linkRichMenuToUser("U123", "richmenu-employee")).resolves.toEqual({ status: 200 });
    await expect(getRichMenuForUser("U123")).resolves.toEqual({ status: 200, richMenuId: "richmenu-employee" });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "https://api.line.test/v2/bot/user/U123/richmenu/richmenu-employee",
      expect.objectContaining({ method: "POST", headers: { Authorization: "Bearer test-token" } }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://api.line.test/v2/bot/user/U123/richmenu",
      expect.objectContaining({ method: "GET", headers: { Authorization: "Bearer test-token" } }),
    );
  });

  it("treats LINE's 404 lookup as no per-user menu", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 404 })));

    const { getRichMenuForUser } = await import("../../server/utils/line-messaging");

    await expect(getRichMenuForUser("U123")).resolves.toEqual({ status: 404, richMenuId: null });
  });
});
