// PRN-04 fake transport behaviors used by the runner tests (no network).

import { describe, expect, it } from "vitest";
import { FakeTransport } from "../../print-bridge/transport/fake.js";
import { TransportError } from "../../print-bridge/transport/transportError.js";
import { createTcpTransport } from "../../print-bridge/transport/tcp.js";
import net from "node:net";

const PAYLOAD = Uint8Array.from([0x1b, 0x40, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06]);

describe("print bridge fake transport", () => {
  it("success path: writes bytes, records chunks, counts totals", async () => {
    const transport = new FakeTransport();
    await transport.connect();
    const written = await transport.write(PAYLOAD);
    await transport.end();
    await transport.close();

    expect(written).toBe(PAYLOAD.byteLength);
    expect(transport.bytesWritten).toBe(PAYLOAD.byteLength);
    expect(transport.chunks).toHaveLength(1);
    expect(Array.from(transport.chunks[0] ?? new Uint8Array())).toEqual(Array.from(PAYLOAD));
    expect(transport.ended).toBe(true);
  });

  it("connectFail rejects before any byte with FAILED_OFFLINE", async () => {
    const transport = new FakeTransport({ connectFail: true });
    await expect(transport.connect()).rejects.toMatchObject({
      name: "TransportError",
      code: "FAILED_OFFLINE",
    });
    expect(transport.bytesWritten).toBe(0);
  });

  it("writeFailAfterBytes performs a partial write then errors with the partial count", async () => {
    const transport = new FakeTransport({ writeFailAfterBytes: 3 });
    await transport.connect();

    const error = await transport.write(PAYLOAD).catch((err: unknown) => err);
    expect(error).toBeInstanceOf(TransportError);
    expect((error as TransportError).code).toBe("FAILED_DEVICE");
    expect((error as TransportError).bytesWritten).toBe(3);
    // The 3 delivered bytes are counted on the transport as well.
    expect(transport.bytesWritten).toBe(3);
    expect(transport.chunks[0]).toEqual(PAYLOAD.subarray(0, 3));
  });

  it("hangThenFail rejects with FAILED_TIMEOUT and unknown byte progress", async () => {
    const transport = new FakeTransport({ hangThenFail: true, hangMs: 5 });
    await transport.connect();

    await expect(transport.write(PAYLOAD)).rejects.toMatchObject({
      name: "TransportError",
      code: "FAILED_TIMEOUT",
    });
    // Explicitly UNKNOWN: no bytesWritten on the error (C8 -> NEEDS_REVIEW).
    const error = await transport.write(PAYLOAD).catch((err) => err);
    expect(error).toBeInstanceOf(TransportError);
    expect(error.bytesWritten).toBeUndefined();
  });

  it("refuses writes before connect", async () => {
    const transport = new FakeTransport();
    await expect(transport.write(PAYLOAD)).rejects.toMatchObject({ code: "FAILED_OFFLINE" });
  });
});

describe("TCP print transport binary contract", () => {
  it("writes the exact Buffer bytes to a TCP socket and rejects text-like inputs", async () => {
    const received: Buffer[] = [];
    const server = net.createServer((socket) => {
      socket.on("data", (chunk) => received.push(chunk));
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const port = (server.address() as net.AddressInfo).port;
    const transport = createTcpTransport({ host: "127.0.0.1", port, timeoutMs: 1000 });
    const payload = Buffer.from([0x1b, 0x40, 0x00, 0xff, 0x80, 0x1d, 0x76, 0x30]);

    try {
      await transport.connect();
      await expect(transport.write(new Uint8Array([1, 2, 3]))).rejects.toThrow(/requires a Buffer/);
      await expect(transport.write(payload)).resolves.toBe(payload.byteLength);
      await transport.end();
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(Buffer.concat(received)).toEqual(payload);
    } finally {
      await transport.close();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});
