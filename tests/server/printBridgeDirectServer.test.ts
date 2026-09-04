import { afterEach, describe, expect, it } from "vitest";
import type { AddressInfo } from "node:net";
import { createPrintGatewayServer, isPrivateNetworkAddress, listenPrintGateway } from "../../print-bridge/server.mjs";
import { createMemoryStateStore } from "../../print-bridge/state.mjs";
import { PrinterMutex } from "../../print-bridge/mutex.mjs";
import { FakeTransport } from "../../print-bridge/transport/fake.js";
import { createHash } from "node:crypto";

const ORIGIN = "https://shop.example.test";
const PRINTER = { id: "printer_one", name: "หน้าเคาน์เตอร์", model: "XP-C260M", host: "192.168.1.10", port: 9100 };
const config = {
  bindHost: "127.0.0.1", port: 0, publicUrl: "http://127.0.0.1:17321", allowedOrigins: [ORIGIN],
  maxPayloadBytes: 8, tcpTimeoutMs: 100,
};
const servers: Array<ReturnType<typeof createPrintGatewayServer>> = [];

const stateStore = () => createMemoryStateStore({
  version: 2,
  printers: [PRINTER],
});
const discovery = {
  probeTarget: async () => true,
  scan: async () => [{ id: "candidate_safe" }],
  resolveCandidate: (id: string) => id === "candidate_safe" ? { id, host: "192.168.1.20", port: 9100 } : null,
};

async function start(overrides: Partial<Parameters<typeof createPrintGatewayServer>[0]> = {}) {
  const server = createPrintGatewayServer({ config, stateStore: stateStore(), discovery, ...overrides });
  servers.push(server);
  await listenPrintGateway(server, { port: 0, bindHost: "127.0.0.1" });
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve) => server.close(() => resolve()))));
});

describe("LAN Print Gateway HTTP server", () => {
  it("recognizes only loopback and private client network addresses", () => {
    expect(isPrivateNetworkAddress("127.0.0.1")).toBe(true);
    expect(isPrivateNetworkAddress("::ffff:192.168.20.8")).toBe(true);
    expect(isPrivateNetworkAddress("fd00::10")).toBe(true);
    expect(isPrivateNetworkAddress("8.8.8.8")).toBe(false);
    expect(isPrivateNetworkAddress("2001:4860:4860::8888")).toBe(false);
  });

  it("allows same-LAN clients without credentials", async () => {
    const baseUrl = await start();
    const health = await fetch(`${baseUrl}/health`, { headers: { origin: ORIGIN } });
    expect(await health.json()).toMatchObject({ available: true });
    expect((await fetch(`${baseUrl}/printers`, { headers: { origin: ORIGIN } })).status).toBe(200);
  });

  it("does not expose a pairing endpoint", async () => {
    const baseUrl = await start();
    const response = await fetch(`${baseUrl}/pair`, {
      method: "POST",
      headers: { origin: ORIGIN, "content-type": "application/json" },
      body: JSON.stringify({ code: "000000" }),
    });
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ code: "NOT_FOUND" });
  });

  it("rejects non-LAN clients in LAN mode", async () => {
    const baseUrl = await start({
      isLanClient: () => false,
    });
    const response = await fetch(`${baseUrl}/health`, { headers: { origin: ORIGIN } });
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ code: "LAN_CLIENT_DENIED" });
  });

  it("binds to configured host and exposes only safe health data", async () => {
    const server = createPrintGatewayServer({ config, stateStore: stateStore(), discovery });
    servers.push(server);
    await listenPrintGateway(server, { port: 0, bindHost: "127.0.0.1" });
    expect((server.address() as AddressInfo).address).toBe("127.0.0.1");
    const response = await fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}/health`, { headers: { origin: ORIGIN } });
    const body = await response.json() as Record<string, unknown>;
    expect(body).toEqual(expect.objectContaining({ available: true }));
    expect(Object.keys(body).sort()).toEqual(["available", "version"]);
  });

  it("requires an exact origin for printer data", async () => {
    const baseUrl = await start();
    expect((await fetch(`${baseUrl}/printers`, { headers: { origin: "https://evil.test" } })).status).toBe(403);
    const response = await fetch(`${baseUrl}/printers`, { headers: { origin: ORIGIN } });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ printers: [{ id: "printer_one", name: "หน้าเคาน์เตอร์", model: "XP-C260M", online: true }] });
  });

  it("returns opaque discovery candidates and trusts only a server-resolved candidate", async () => {
    const store = stateStore();
    const baseUrl = await start({ stateStore: store });
    const discovered = await fetch(`${baseUrl}/discover`, { method: "POST", headers: { origin: ORIGIN } });
    expect(await discovered.json()).toEqual({ candidates: [{ id: "candidate_safe", name: "เครื่องพิมพ์ที่พบ 1" }] });
    const trusted = await fetch(`${baseUrl}/printers/trust`, {
      method: "POST", headers: { origin: ORIGIN, "content-type": "application/json" },
      body: JSON.stringify({ candidateId: "candidate_safe", name: "เครื่องสำรอง", host: "8.8.8.8" }),
    });
    expect(trusted.status).toBe(201);
    const saved = await store.read();
    expect(saved.printers.at(-1)).toMatchObject({ name: "เครื่องสำรอง", host: "192.168.1.20", port: 9100 });
  });

  it("sends one binary payload to the selected trusted printer", async () => {
    const transport = new FakeTransport();
    let selected: unknown;
    const baseUrl = await start({ createTransport: (printer: unknown) => { selected = printer; return transport; } });
    const response = await fetch(`${baseUrl}/print/printer_one`, {
      method: "POST", headers: { origin: ORIGIN, "content-type": "application/octet-stream" },
      body: Uint8Array.from([0x1b, 0x40, 1]),
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, code: "SENT" });
    expect(selected).toMatchObject({ id: "printer_one", host: "192.168.1.10" });
    expect(Array.from(transport.chunks[0] ?? [])).toEqual([0x1b, 0x40, 1]);
  });

  it("preserves a binary raster payload byte-for-byte from HTTP body to transport", async () => {
    const payload = Buffer.from([
      0x1b, 0x40,
      0x1d, 0x76, 0x30, 0x00, 0x02, 0x00, 0x02, 0x00,
      0x00, 0xff, 0x80, 0x01,
      0x0a, 0x00, 0xfe, 0x7f,
    ]);
    const transport = new FakeTransport();
    const baseUrl = await start({
      config: { ...config, maxPayloadBytes: 100 },
      createTransport: () => transport,
    });
    const response = await fetch(`${baseUrl}/print/printer_one`, {
      method: "POST",
      headers: { origin: ORIGIN, "content-type": "application/octet-stream" },
      body: payload,
    });
    const received = Buffer.from(transport.chunks[0] ?? []);

    expect(response.status).toBe(200);
    expect(Buffer.isBuffer(transport.chunks[0])).toBe(true);
    expect(received).toEqual(payload);
    expect(createHash("sha256").update(received).digest("hex"))
      .toBe(createHash("sha256").update(payload).digest("hex"));
  });

  it("rejects arbitrary/unknown printer ids before creating a transport", async () => {
    let created = 0;
    const baseUrl = await start({ createTransport: () => { created += 1; return new FakeTransport(); } });
    const response = await fetch(`${baseUrl}/print/192.168.1.99`, {
      method: "POST", headers: { origin: ORIGIN, "content-type": "application/octet-stream" }, body: new Uint8Array([1]),
    });
    expect(response.status).toBe(404);
    expect(created).toBe(0);
  });

  it("uses a fail-fast mutex per printer and preserves unknown-progress semantics", async () => {
    const mutex = new PrinterMutex();
    const release = mutex.acquire("printer_one");
    const baseUrl = await start({ mutex });
    const busy = await fetch(`${baseUrl}/print/printer_one`, {
      method: "POST", headers: { origin: ORIGIN, "content-type": "application/octet-stream" }, body: new Uint8Array([1]),
    });
    release();
    expect(busy.status).toBe(409);

    const uncertainUrl = await start({ createTransport: () => new FakeTransport({ writeFailAfterBytes: 0 }), log: { warn: () => undefined } });
    const uncertain = await fetch(`${uncertainUrl}/print/printer_one`, {
      method: "POST", headers: { origin: ORIGIN, "content-type": "application/octet-stream" }, body: new Uint8Array([1]),
    });
    expect(await uncertain.json()).toMatchObject({ code: "UNKNOWN_PROGRESS", bytesMayHaveBeenWritten: true });
  });
});
