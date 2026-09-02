/**
 * DB-04.1 compatibility telemetry contract tests.
 *
 * The telemetry must be aggregate-only: stable metric names, path/result
 * dimensions bounded by the real call sites, and a sanitized bounded error
 * code (Prisma P-codes, UPPER_SNAKE application codes, HTTP_<status> fallback
 * — anything else is UNKNOWN). It must never carry record IDs, raw messages,
 * stacks, URLs, tokens, or customer data, and it must never break the
 * business transaction when emission itself fails.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  COMPAT_METRICS,
  compatErrorCode,
  emitCompatFailure,
  emitCompatTelemetry,
  withCompatTelemetry,
} from "../../server/utils/compatTelemetry";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("compatErrorCode (sanitized, bounded error identity)", () => {
  it("keeps real Prisma, application, and HTTP fallback codes", () => {
    expect(compatErrorCode({ data: { code: "SERVICE_ORDER_STATUS_CONFLICT" }, code: "P2025", statusCode: 409 })).toBe(
      "SERVICE_ORDER_STATUS_CONFLICT",
    );
    expect(compatErrorCode({ code: "P1001" })).toBe("P1001");
    expect(compatErrorCode({ code: "P2025" })).toBe("P2025");
    expect(compatErrorCode({ statusCode: 404 })).toBe("HTTP_404");
    expect(compatErrorCode(new Error("boom"))).toBe("UNKNOWN");
    expect(compatErrorCode(undefined)).toBe("UNKNOWN");
    expect(compatErrorCode("garbage")).toBe("UNKNOWN");
  });

  it("returns UNKNOWN for arbitrary codes: whitespace, URLs, provider strings", () => {
    expect(compatErrorCode({ code: "connect ECONNREFUSED 10.0.0.1:5432" })).toBe("UNKNOWN");
    expect(compatErrorCode({ code: "postgres://user:secret@db.example.test:5432/app" })).toBe("UNKNOWN");
    expect(compatErrorCode({ code: "db down (timeout)" })).toBe("UNKNOWN");
    expect(compatErrorCode({ data: { code: " bad" } })).toBe("UNKNOWN");
    expect(compatErrorCode({ code: "" })).toBe("UNKNOWN");
  });

  it("returns UNKNOWN for codes longer than the 64-character bound", () => {
    expect(compatErrorCode({ code: "A".repeat(64) })).toBe("A".repeat(64));
    expect(compatErrorCode({ code: "A".repeat(65) })).toBe("UNKNOWN");
  });

  it("returns UNKNOWN for a status code outside the HTTP range or non-integer", () => {
    expect(compatErrorCode({ statusCode: 999 })).toBe("UNKNOWN");
    expect(compatErrorCode({ statusCode: 99 })).toBe("UNKNOWN");
    expect(compatErrorCode({ statusCode: 409.5 })).toBe("UNKNOWN");
    expect(compatErrorCode({ statusCode: Number.NaN })).toBe("UNKNOWN");
  });

  it("falls through an invalid data.code to a valid code or the HTTP status", () => {
    expect(compatErrorCode({ data: { code: "not a stable code" }, code: "P2025" })).toBe("P2025");
    expect(compatErrorCode({ data: { code: "not a stable code" }, statusCode: 409 })).toBe("HTTP_409");
  });

  it("never returns the error message or stack", () => {
    const error = Object.assign(new Error("secret connection string postgres://..."), { code: "P2025" });
    expect(compatErrorCode(error)).toBe("P2025");
    expect(compatErrorCode(error)).not.toContain("secret");
  });
});

describe("emitCompatTelemetry (structured, bounded, never throws)", () => {
  it("logs success on console.info with metric/path/result only", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    emitCompatTelemetry({ metric: COMPAT_METRICS.addonRefund, path: "status-patch", result: "normalized" });
    expect(info).toHaveBeenCalledWith("[db-compat]", {
      metric: "db_compat_addon_refund_total",
      path: "status-patch",
      result: "normalized",
    });
  });

  it("logs failures on console.error with the sanitized errorCode", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    emitCompatTelemetry({
      metric: COMPAT_METRICS.paymentStatusSync,
      path: "state",
      result: "failure",
      errorCode: "HTTP_409",
    });
    expect(errorSpy).toHaveBeenCalledWith("[db-compat]", {
      metric: "db_compat_payment_status_sync_total",
      path: "state",
      result: "failure",
      errorCode: "HTTP_409",
    });
  });

  it("never logs raw messages, stacks, or provider text on failure", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const failure = Object.assign(
      new Error("postgres://admin:hunter2@10.0.0.1:5432/prod failed after record order-123"),
      { stack: "Error: postgres://admin:hunter2@..." },
    );
    emitCompatFailure(COMPAT_METRICS.orderTransition, "status-patch", failure);

    const payload = errorSpy.mock.calls[0]?.[1] as Record<string, string>;
    expect(Object.keys(payload).sort()).toEqual(["errorCode", "metric", "path", "result"]);
    expect(JSON.stringify(payload)).not.toContain("hunter2");
    expect(JSON.stringify(payload)).not.toContain("order-123");
    expect(JSON.stringify(payload)).not.toContain("postgres");
    expect(payload.errorCode).toBe("UNKNOWN");
  });

  it("swallows console failures so telemetry never breaks the request", () => {
    vi.spyOn(console, "info").mockImplementation(() => {
      throw new Error("console broken");
    });
    expect(() =>
      emitCompatTelemetry({ metric: COMPAT_METRICS.itemPhotoWrite, path: "create", result: "success" }),
    ).not.toThrow();
  });

  it("keeps the business failure propagating when the failure emission itself throws", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {
      throw new Error("console broken");
    });
    const failure = Object.assign(new Error("db down"), { code: "P1001" });

    await expect(
      withCompatTelemetry("shop", async () => {
        throw failure;
      }),
    ).rejects.toBe(failure);
  });
});

describe("withCompatTelemetry (settings compatibility paths)", () => {
  it("emits success only after the operation resolves and returns its value", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const calls: string[] = [];

    const value = await withCompatTelemetry("shop", async () => {
      calls.push("operation");
      return "result-value";
    });

    expect(value).toBe("result-value");
    expect(calls).toEqual(["operation"]);
    expect(info).toHaveBeenCalledWith("[db-compat]", {
      metric: COMPAT_METRICS.settingWrite,
      path: "shop",
      result: "success",
    });
  });

  it("emits a sanitized failure and rethrows when the operation fails", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const failure = Object.assign(new Error("db down"), { code: "P1001" });

    await expect(
      withCompatTelemetry("notification", async () => {
        throw failure;
      }),
    ).rejects.toBe(failure);

    expect(errorSpy).toHaveBeenCalledWith("[db-compat]", {
      metric: COMPAT_METRICS.settingWrite,
      path: "notification",
      result: "failure",
      errorCode: "P1001",
    });
  });

  it("keeps the stable settings metric name", () => {
    expect(COMPAT_METRICS.settingWrite).toBe("db_compat_setting_write_total");
  });
});
