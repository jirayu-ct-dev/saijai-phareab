/**
 * Per-printer mutex (PRN-04): only one send loop may be active per printerId.
 * v1 drives a single printer, but the structure is a Map keyed by printerId so
 * additional printers can be added without changing call sites.
 */

export class PrinterMutex {
  #locks = new Map();

  /**
   * Acquires the lock for a printer.
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
