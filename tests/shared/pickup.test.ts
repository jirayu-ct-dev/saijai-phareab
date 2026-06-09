import { describe, expect, it } from "vitest";
import { formatDateTime } from "../../shared/utils/format";
import { parseBangkokDateBoundary, parseBangkokDateTime } from "../../shared/utils/pickup";

describe("Bangkok pickup date parsing", () => {
  it("treats timezone-less datetime input as Bangkok local time", () => {
    const parsed = parseBangkokDateTime("2026-06-10T17:00");

    expect(parsed?.toISOString()).toBe("2026-06-10T10:00:00.000Z");
    expect(formatDateTime(parsed as Date)).toContain("17:00 น.");
  });

  it("keeps explicit timezone input as the provided instant", () => {
    const parsed = parseBangkokDateTime("2026-06-10T10:00:00.000Z");

    expect(parsed?.toISOString()).toBe("2026-06-10T10:00:00.000Z");
    expect(formatDateTime(parsed as Date)).toContain("17:00 น.");
  });

  it("rejects invalid Bangkok local dates", () => {
    const parsed = parseBangkokDateTime("2026-02-30T17:00");

    expect(parsed).toBeInstanceOf(Date);
    expect(Number.isNaN(parsed?.getTime())).toBe(true);
  });

  it("builds Bangkok day boundaries from date-only input", () => {
    const start = parseBangkokDateBoundary("2026-06-10", "start");
    const end = parseBangkokDateBoundary("2026-06-10", "end");

    expect(start?.toISOString()).toBe("2026-06-09T17:00:00.000Z");
    expect(end?.toISOString()).toBe("2026-06-10T16:59:59.999Z");
  });

  it("builds Bangkok day boundaries from explicit UTC input", () => {
    const start = parseBangkokDateBoundary("2026-06-09T17:00:00.000Z", "start");
    const end = parseBangkokDateBoundary("2026-06-09T17:00:00.000Z", "end");

    expect(start?.toISOString()).toBe("2026-06-09T17:00:00.000Z");
    expect(end?.toISOString()).toBe("2026-06-10T16:59:59.999Z");
  });
});
