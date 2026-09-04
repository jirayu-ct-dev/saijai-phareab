import type { PrinterCapabilities } from "../types/printing";

/** Optional printer features stay disabled until the actual unit proves them. */
export const createPrinterCapabilities = (
  overrides: Partial<PrinterCapabilities> = {},
): PrinterCapabilities => ({
  partialCut: false,
  nativeQr: false,
  nativeBarcode: false,
  pdf417: false,
  nvLogo: false,
  buzzer: false,
  statusQuery: false,
  cashDrawer: false,
  blackMark: false,
  ...overrides,
});
