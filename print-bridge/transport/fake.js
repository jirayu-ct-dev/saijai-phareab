/**
 * In-memory fake transport for tests (PRN-04). No network, no hardware.
 *
 * Behavior options (all optional):
 *   connectFail        -> connect() rejects with FAILED_OFFLINE
 *   connectDelayMs     -> connect() resolves after a delay
 *   writeFailAfterBytes-> writes fail once cumulative bytes exceed this value;
 *                         the failing write first "delivers" the allowed
 *                         partial bytes and the error carries bytesWritten
 *   hangThenFail       -> write() hangs (hangMs, default 50) then rejects with
 *                         FAILED_TIMEOUT and UNKNOWN bytesWritten
 *   endFail            -> end() rejects with FAILED_DEVICE
 *
 * Records everything written so tests can assert on the byte stream.
 */
import { TransportError } from "./transportError.js";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export class FakeTransport {
  constructor(behavior = {}) {
    this.behavior = behavior;
    /** @type {Uint8Array[]} */
    this.chunks = [];
    this.bytesWritten = 0;
    this.connected = false;
    this.ended = false;
    this.closed = false;
  }

  async connect() {
    if (this.behavior.connectDelayMs) {
      await sleep(this.behavior.connectDelayMs);
    }
    if (this.behavior.connectFail) {
      throw new TransportError("FAILED_OFFLINE", "fake transport: connect refused");
    }
    this.connected = true;
  }

  async write(bytes) {
    if (!this.connected) {
      throw new TransportError("FAILED_OFFLINE", "fake transport: not connected");
    }
    const size = bytes ? bytes.byteLength : 0;

    if (this.behavior.hangThenFail) {
      await sleep(this.behavior.hangMs ?? 50);
      // The bridge cannot know what reached the wire during a hang: leave
      // bytesWritten undefined on the error (unknown -> NEEDS_REVIEW).
      throw new TransportError("FAILED_TIMEOUT", "fake transport: write hung then failed");
    }

    const failAfter = this.behavior.writeFailAfterBytes;
    if (typeof failAfter === "number" && this.bytesWritten + size > failAfter) {
      const allowed = Math.max(0, failAfter - this.bytesWritten);
      if (allowed > 0) {
        this.chunks.push(bytes.subarray(0, allowed));
        this.bytesWritten += allowed;
      }
      throw new TransportError("FAILED_DEVICE", "fake transport: partial write then error", {
        bytesWritten: allowed,
      });
    }

    this.chunks.push(bytes);
    this.bytesWritten += size;
    return size;
  }

  async end() {
    if (this.behavior.endFail) {
      throw new TransportError("FAILED_DEVICE", "fake transport: end failed");
    }
    this.ended = true;
  }

  async close() {
    this.closed = true;
  }
}
