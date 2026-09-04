import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { toPrintResponseBuffer } from "../../server/utils/printBinary";

const servers: http.Server[] = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) =>
    new Promise<void>((resolve) => server.close(() => resolve())),
  ));
});

describe("binary print response", () => {
  it("preserves an offset Uint8Array through the Node HTTP response body used by Nitro", async () => {
    const backing = Uint8Array.from([0xaa, 0x1b, 0x40, 0x00, 0xff, 0x80, 0x55]);
    const expected = backing.subarray(1, 6);
    const body = toPrintResponseBuffer(expected);
    const server = http.createServer((_request, response) => {
      response.writeHead(200, { "content-type": "application/octet-stream" });
      response.end(body);
    });
    servers.push(server);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));

    const response = await fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}/document`);
    const received = new Uint8Array(await response.arrayBuffer());

    expect(response.headers.get("content-type")).toBe("application/octet-stream");
    expect(received).toEqual(expected);
  });
});
