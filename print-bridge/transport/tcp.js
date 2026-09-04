/**
 * TCP transport for the immediate local bridge.
 *
 * Connects a node:net socket to the locally configured tcpTarget {host, port}.
 * The host and port are read from local config ONLY — they are never included
 * in any event, log payload sent to the server, or API body.
 *
 * Byte accounting:
 *   - write() resolves with the number of bytes accepted by the socket.
 *   - A write timeout mid-send is UNKNOWN with respect to what reached the
 *     printer (the OS may have flushed part of the buffer), so the error
 *     carries no bytesWritten. The bridge treats every failure after write()
 *     begins as UNKNOWN_PROGRESS, regardless of this diagnostic count.
 */

import net from "node:net";
import { TransportError } from "./transportError.js";
import { fingerprintBuffer } from "../byteFingerprint.mjs";

const defaultSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function createTcpTransport({
  host,
  port,
  timeoutMs = 10000,
  sleep = defaultSleep,
  debugBytes = false,
  log = console,
} = {}) {
  if (typeof host !== "string" || host.length === 0) {
    throw new Error("TCP transport requires a host");
  }
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("TCP transport requires a port between 1 and 65535");
  }

  let socket = null;
  let connected = false;
  let cumulativeBytes = 0;

  function destroyQuietly() {
    if (socket) {
      socket.removeAllListeners();
      socket.destroy();
      socket = null;
    }
    connected = false;
  }

  return {
    get bytesWritten() {
      return cumulativeBytes;
    },

    async connect() {
      await new Promise((resolve, reject) => {
        socket = net.createConnection({ host, port });
        let settled = false;
        let timer = null;

        const settle = (fn, value) => {
          if (settled) return;
          settled = true;
          if (timer) clearTimeout(timer);
          socket?.removeListener("error", onError);
          fn(value);
        };

        const onError = (err) => {
          destroyQuietly();
          settle(reject, new TransportError("FAILED_OFFLINE", "TCP connect failed", {}));
        };

        socket.once("error", onError);
        socket.once("connect", () => {
          connected = true;
          settle(resolve);
        });

        timer = setTimeout(() => {
          destroyQuietly();
          settle(reject, new TransportError("FAILED_TIMEOUT", "TCP connect timed out", {}));
        }, timeoutMs);
      });
    },

    async write(bytes) {
      if (!connected || !socket) {
        throw new TransportError("FAILED_OFFLINE", "TCP transport is not connected");
      }
      if (!Buffer.isBuffer(bytes)) {
        throw new TypeError("TCP print transport requires a Buffer");
      }
      const payload = bytes;
      if (debugBytes) {
        log.debug(`Print payload F ${JSON.stringify(fingerprintBuffer(payload))}`, "PRINT_BYTES_F");
      }

      await new Promise((resolve, reject) => {
        let settled = false;
        const timer = setTimeout(() => {
          if (settled) return;
          settled = true;
          socket?.removeListener("error", onError);
          // Unknown progress: bytes may have been flushed mid-send.
          reject(new TransportError("FAILED_TIMEOUT", "TCP write timed out"));
        }, timeoutMs);

        const onError = (err) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          reject(new TransportError("FAILED_DEVICE", "TCP write failed", { bytesWritten: 0 }));
        };

        socket.once("error", onError);
        socket.write(payload, (err) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          socket?.removeListener("error", onError);
          if (err) {
            reject(new TransportError("FAILED_DEVICE", "TCP write failed", { bytesWritten: 0 }));
            return;
          }
          cumulativeBytes += payload.byteLength;
          resolve(payload.byteLength);
        });
      });
      return payload.byteLength;
    },

    /** Half-closes after flushing pending data; resolves when the peer ACKs. */
    async end() {
      if (!connected || !socket) {
        throw new TransportError("FAILED_OFFLINE", "TCP transport is not connected");
      }
      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          // Drain uncertain: treat as unknown-progress failure.
          reject(new TransportError("FAILED_TIMEOUT", "TCP end timed out"));
        }, timeoutMs);
        socket.end("", () => {
          clearTimeout(timer);
          resolve();
        });
        socket.once("error", (err) => {
          clearTimeout(timer);
          reject(new TransportError("FAILED_DEVICE", "TCP end failed", { bytesWritten: 0 }));
        });
      });
    },

    /** Hard close; safe to call multiple times. */
    async close() {
      destroyQuietly();
      await sleep(0);
    },
  };
}
