import { describe, expect, it } from "vitest";
import { parsePickupConfirmationPostback } from "../../shared/utils/pickupConfirmationPostback";

describe("pickup confirmation postback", () => {
  it("parses a valid opaque confirmation response", () => {
    expect(parsePickupConfirmationPostback(
      "action=pickup_confirmation&id=opaque%3A123&rev=2&response=HOME_PICKUP",
    )).toEqual({ confirmationId: "opaque:123", revision: 2, response: "HOME_PICKUP" });
  });

  it("rejects unknown actions, invalid revisions, and response injection", () => {
    expect(parsePickupConfirmationPostback("action=other&id=x&rev=1&response=SKIP")).toBeNull();
    expect(parsePickupConfirmationPostback("action=pickup_confirmation&id=x&rev=0&response=SKIP")).toBeNull();
    expect(parsePickupConfirmationPostback("action=pickup_confirmation&id=x&rev=1&response=DELETE")).toBeNull();
  });
});
