/**
 * In-memory mutex: only one immediate send may be active for the local printer.
 */

export class PrinterMutex {
  #locks = new Map();

  /**
   * Acquires the fail-fast lock for the named local resource.
   * @returns {() => void} release function
   * @throws when a send loop is already active for the printer
   */
  acquire(printerId) {
    if (this.#locks.has(printerId)) {
      throw new Error(`Printer "${printerId}" is busy: another send loop is already active`);
    }
    const token = Symbol("printer-lock");
    this.#locks.set(printerId, token);
    return () => {
      if (this.#locks.get(printerId) === token) {
        this.#locks.delete(printerId);
      }
    };
  }

  isLocked(printerId) {
    return this.#locks.has(printerId);
  }
}
