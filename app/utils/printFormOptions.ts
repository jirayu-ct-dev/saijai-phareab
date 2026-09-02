import type {
  PaperWidthMm,
  PrintRenderMode,
  PrintTransport,
  PrintableDots,
  PrinterCapabilities,
} from "~~/shared/types/printing";

// Shared presentation options for the printer profile form (PRN-06), used by
// the admin printing page's register form and edit form.

export const TRANSPORT_OPTIONS: Array<{ label: string; value: PrintTransport }> = [
  { label: "Wi-Fi", value: "WIFI" },
  { label: "Ethernet (สายแลน)", value: "ETHERNET" },
  { label: "USB", value: "USB" },
  { label: "Bluetooth", value: "BLUETOOTH" },
];

export const PAPER_WIDTH_OPTIONS: Array<{ label: string; value: PaperWidthMm }> = [
  { label: "80 มม.", value: 80 },
  { label: "58 มม.", value: 58 },
];

export const PRINTABLE_DOTS_OPTIONS: Array<{ label: string; value: PrintableDots }> = [
  { label: "576 จุด", value: 576 },
  { label: "512 จุด", value: 512 },
  { label: "384 จุด", value: 384 },
];

export const RENDER_MODE_OPTIONS: Array<{ label: string; value: PrintRenderMode }> = [
  { label: "HYBRID (ข้อความ + ภาพผสม)", value: "HYBRID" },
  { label: "RASTER (ภาพทั้งหมด)", value: "RASTER" },
];

export const CAPABILITY_ITEMS: ReadonlyArray<{ key: keyof PrinterCapabilities; label: string }> = Object.freeze([
  { key: "partialCut", label: "ตัดกระดาษบางส่วน" },
  { key: "nativeQr", label: "พิมพ์ QR ในตัวเครื่อง" },
  { key: "nativeBarcode", label: "พิมพ์บาร์โค้ดในตัวเครื่อง" },
  { key: "pdf417", label: "พิมพ์ PDF417 ในตัวเครื่อง" },
  { key: "nvLogo", label: "โลโก้ในหน่วยความจำเครื่อง" },
  { key: "buzzer", label: "เสียงแจ้งเตือน (บัซเซอร์)" },
  { key: "statusQuery", label: "สอบถามสถานะเครื่อง" },
  { key: "cashDrawer", label: "ลิ้นชักเก็บเงิน" },
  { key: "blackMark", label: "เซ็นเซอร์กระดาษ (Black mark)" },
]);

/** Value shape bound by AdminPrinterForm via defineModel. */
export type PrinterFormValue = {
  name: string;
  defaultTransport: PrintTransport;
  paperWidthMm: PaperWidthMm;
  printableDots: PrintableDots;
  renderMode: PrintRenderMode;
  capabilities: PrinterCapabilities;
};
