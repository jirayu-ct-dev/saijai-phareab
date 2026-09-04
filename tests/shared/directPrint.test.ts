import { describe, expect, it, vi } from "vitest";
import {
  binaryResponseToPrintBytes,
  DirectPrintFailure,
  DirectPrintMutex,
  executeDirectPrint,
} from "../../shared/utils/directPrint";

describe("direct print orchestration", () => {
  it("reads browser binary responses through arrayBuffer without UTF-8 decoding", async () => {
    const expected = Uint8Array.from([0x1b, 0x40, 0x00, 0xff, 0x80, 0x1d, 0x76, 0x30]);
    let arrayBufferCalls = 0;
    const response = {
      arrayBuffer: async () => {
        arrayBufferCalls += 1;
        return Uint8Array.from(expected).buffer;
      },
    };

    await expect(binaryResponseToPrintBytes(response)).resolves.toEqual(expected);
    expect(arrayBufferCalls).toBe(1);
  });

  it("connects on demand and resumes the same print attempt", async () => {
    const calls: string[] = [];
    const result = await executeDirectPrint({
      ensureConnected: async () => { calls.push("connect"); return true; },
      loadBytes: async () => { calls.push("load"); return new Uint8Array([1, 2]); },
      sendBytes: async () => { calls.push("send"); },
    }, new DirectPrintMutex());

    expect(result).toEqual({ ok: true, code: "SENT" });
    expect(calls).toEqual(["connect", "load", "send"]);
  });

  it("returns immediately as BUSY instead of queueing a concurrent attempt", async () => {
    let finishFirst!: () => void;
    const firstSend = new Promise<void>((resolve) => { finishFirst = resolve; });
    const mutex = new DirectPrintMutex();
    const first = executeDirectPrint({
      ensureConnected: async () => true,
      loadBytes: async () => new Uint8Array([1]),
      sendBytes: async () => firstSend,
    }, mutex);

    await vi.waitFor(() => expect(mutex.isLocked).toBe(true));
    const second = await executeDirectPrint({
      ensureConnected: async () => true,
      loadBytes: async () => new Uint8Array([2]),
      sendBytes: async () => undefined,
    }, mutex);

    expect(second).toEqual({ ok: false, code: "BUSY", bytesMayHaveBeenWritten: false });
    finishFirst();
    await expect(first).resolves.toEqual({ ok: true, code: "SENT" });
  });

  it("does not load or send when the user does not connect", async () => {
    const loadBytes = vi.fn(async () => new Uint8Array([1]));
    const sendBytes = vi.fn(async () => undefined);
    const result = await executeDirectPrint({
      ensureConnected: async () => false,
      loadBytes,
      sendBytes,
    }, new DirectPrintMutex());

    expect(result.code).toBe("NOT_CONNECTED");
    expect(loadBytes).not.toHaveBeenCalled();
    expect(sendBytes).not.toHaveBeenCalled();
  });

  it("never retries after sending starts and reports unknown progress", async () => {
    const sendBytes = vi.fn(async () => { throw new Error("connection reset"); });
    const result = await executeDirectPrint({
      ensureConnected: async () => true,
      loadBytes: async () => new Uint8Array([1, 2, 3]),
      sendBytes,
    }, new DirectPrintMutex());

    expect(sendBytes).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      ok: false,
      code: "UNKNOWN_PROGRESS",
      bytesMayHaveBeenWritten: true,
    });
  });

  it("preserves a proven pre-byte timeout from the transport", async () => {
    const result = await executeDirectPrint({
      ensureConnected: async () => true,
      loadBytes: async () => new Uint8Array([1]),
      sendBytes: async () => {
        throw new DirectPrintFailure("TIMEOUT", "write did not start");
      },
    }, new DirectPrintMutex());

    expect(result).toEqual({ ok: false, code: "TIMEOUT", bytesMayHaveBeenWritten: false });
  });
});
