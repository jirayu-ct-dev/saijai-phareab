import type {
  DirectPrintResult,
  DirectPrintResultCode,
} from "../types/printing";

type DirectPrintFailureCode = Exclude<DirectPrintResultCode, "SENT" | "UNKNOWN_PROGRESS">;

/** A boundary error that can prove whether sending had started. */
export class DirectPrintFailure extends Error {
  readonly code: DirectPrintFailureCode;
  readonly bytesMayHaveBeenWritten: boolean;

  constructor(
    code: DirectPrintFailureCode,
    message: string,
    options: { bytesMayHaveBeenWritten?: boolean; cause?: unknown } = {},
  ) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = "DirectPrintFailure";
    this.code = code;
    this.bytesMayHaveBeenWritten = options.bytesMayHaveBeenWritten ?? false;
  }
}

export type DirectPrintAttempt = {
  /** Returns true when a transport is ready. May open a chooser once. */
  ensureConnected: () => Promise<boolean>;
  /** Loads canonical server-rendered bytes only after a transport is ready. */
  loadBytes: () => Promise<Uint8Array>;
  /** Sends exactly once. Implementations must not retry internally. */
  sendBytes: (bytes: Uint8Array) => Promise<void>;
};

/**
 * Process-local guard used by one UI action or one bridge instance. A second
 * attempt fails immediately with BUSY; it is never queued behind the first.
 */
export class DirectPrintMutex {
  #locked = false;

  tryAcquire(): (() => void) | null {
    if (this.#locked) return null;
    this.#locked = true;
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.#locked = false;
    };
  }

  get isLocked(): boolean {
    return this.#locked;
  }
}

/** Browser response boundary: preserve arbitrary ESC/POS bytes without text decoding. */
export async function binaryResponseToPrintBytes(
  response: Pick<Blob, "arrayBuffer">,
): Promise<Uint8Array> {
  return new Uint8Array(await response.arrayBuffer());
}

const failure = (
  code: Exclude<DirectPrintResultCode, "SENT">,
  bytesMayHaveBeenWritten = false,
): DirectPrintResult => ({ ok: false, code, bytesMayHaveBeenWritten });

function beforeSendFailure(error: unknown): DirectPrintResult {
  if (error instanceof DirectPrintFailure) {
    return failure(error.code, error.bytesMayHaveBeenWritten);
  }
  return failure("OFFLINE");
}

function afterSendFailure(error: unknown): DirectPrintResult {
  if (error instanceof DirectPrintFailure && !error.bytesMayHaveBeenWritten) {
    return failure(error.code);
  }
  return failure("UNKNOWN_PROGRESS", true);
}

/** Runs one attempt with no queue and no implicit retry. */
export async function executeDirectPrint(
  attempt: DirectPrintAttempt,
  mutex: DirectPrintMutex,
): Promise<DirectPrintResult> {
  const release = mutex.tryAcquire();
  if (!release) return failure("BUSY");

  try {
    let connected: boolean;
    try {
      connected = await attempt.ensureConnected();
    } catch (error) {
      return beforeSendFailure(error);
    }
    if (!connected) return failure("NOT_CONNECTED");

    let bytes: Uint8Array;
    try {
      bytes = await attempt.loadBytes();
    } catch (error) {
      return beforeSendFailure(error);
    }
    if (!(bytes instanceof Uint8Array) || bytes.byteLength === 0) {
      return failure("OFFLINE");
    }

    try {
      await attempt.sendBytes(bytes);
      return { ok: true, code: "SENT" };
    } catch (error) {
      return afterSendFailure(error);
    }
  } finally {
    release();
  }
}
