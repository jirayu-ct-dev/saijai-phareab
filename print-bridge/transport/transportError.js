/**
 * Transport error carrying only a safe code and, when KNOWN, how many bytes
 * of the current call were written.
 *
 * `bytesWritten` semantics for the runner:
 *   - number          -> exactly that many bytes of this call reached the wire
 *   - undefined       -> UNKNOWN (timeout/hang mid-write): must be treated as
 *                        "bytes may have been written" (C8: NEEDS_REVIEW)
 */
export class TransportError extends Error {
  /**
   * @param {"FAILED_OFFLINE"|"FAILED_TIMEOUT"|"FAILED_DEVICE"} code
   * @param {string} message
   * @param {{bytesWritten?: number}} [details]
   */
  constructor(code, message, details) {
    super(message);
    this.name = "TransportError";
    this.code = code;
    if (details && typeof details.bytesWritten === "number") {
      this.bytesWritten = details.bytesWritten;
    }
  }
}
