import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PrintDocument } from "../../shared/types/printing";
import { renderDirectEscpos } from "../../server/utils/directPrintRenderer";

const originalCwd = process.cwd();

afterEach(() => {
  process.chdir(originalCwd);
  vi.unstubAllGlobals();
});

describe("direct print server assets", () => {
  it("renders Thai and the shop logo without a deployment-local public directory", async () => {
    const [regularFont, boldFont, logo] = await Promise.all([
      readFile(path.join(originalCwd, "public/fonts/Prompt-normal-400-thai.woff2")),
      readFile(path.join(originalCwd, "public/fonts/Prompt-normal-700-thai.woff2")),
      readFile(path.join(originalCwd, "public/logo-saijai-phareab.png")),
    ]);
    const assets = new Map<string, Buffer>([
      ["fonts/Prompt-normal-400-thai.woff2", regularFont],
      ["fonts/Prompt-normal-700-thai.woff2", boldFont],
      ["logo-saijai-phareab.png", logo],
    ]);
    const assetStorage = { getItemRaw: async (key: string) => assets.get(key) ?? null };
    const useStorage = vi.fn(() => assetStorage);
    vi.stubGlobal("useStorage", useStorage);

    const isolatedCwd = await mkdtemp(path.join(tmpdir(), "saijai-print-assets-"));
    process.chdir(isolatedCwd);
    try {
      const document: PrintDocument = {
        kind: "QUOTATION",
        documentId: "payment-1",
        documentNo: "QT-0001",
        revision: 1,
        issuedAt: "2026-09-03T10:00:00.000Z",
        shop: {
          name: "ร้านใส่ใจผ้าเรียบ",
          addressLine: null,
          phoneNumber: null,
          taxId: null,
          logoUrl: "/logo-saijai-phareab.png",
        },
        customer: { name: "ลูกค้าทดสอบ", phoneNumber: null },
        items: [{
          name: "ซักพับ",
          quantity: 1,
          unitPriceMinor: 10000,
          totalPriceMinor: 10000,
          note: null,
        }],
        totals: {
          subtotalAmountMinor: 10000,
          discountAmountMinor: 0,
          totalAmountMinor: 10000,
        },
        note: null,
        qrBlocks: [],
      };

      const result = await renderDirectEscpos(document, 576);

      expect(result.bytes.byteLength).toBeGreaterThan(1000);
      expect(useStorage).toHaveBeenCalledWith("assets:printing");
    } finally {
      process.chdir(originalCwd);
      await rm(isolatedCwd, { recursive: true, force: true });
    }
  });
});
