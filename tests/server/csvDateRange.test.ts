import { describe, expect, it } from "vitest";
import { formatBangkokDateTag, parseDateRange } from "../../server/utils/csv";

describe("CSV Bangkok date ranges", () => {
  it("parses date-only range as full Bangkok days", () => {
    const { from, to } = parseDateRange("2026-06-10", "2026-06-10");

    expect(from.toISOString()).toBe("2026-06-09T17:00:00.000Z");
    expect(to.toISOString()).toBe("2026-06-10T16:59:59.999Z");
    expect(formatBangkokDateTag(from)).toBe("2026-06-10");
    expect(formatBangkokDateTag(to)).toBe("2026-06-10");
  });

  it("parses explicit UTC midnight from Bangkok calendar inputs as the selected Bangkok day", () => {
    const { from, to } = parseDateRange("2026-06-09T17:00:00.000Z", "2026-06-09T17:00:00.000Z");

    expect(from.toISOString()).toBe("2026-06-09T17:00:00.000Z");
    expect(to.toISOString()).toBe("2026-06-10T16:59:59.999Z");
  });
});
