// prn02-client-smoke.ts — inserts and reads a Printer + PrintJob row through
// the generated Prisma client against the disposable rehearsal database.
// Proves the client's enum serialization (including the PrinterModel
// @map("XP-C260M") value mapping) round-trips against the migration's DB enum.
//
// Run by scripts/printing-rehearsal/run-prn02-constraints.sh with
// DATABASE_URL/DIRECT_URL pointing at the throwaway database. Exits non-zero
// on any mismatch.

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, PrintJobStatus, PrintTransport } from "../../app/generated/prisma/client";

async function main(): Promise<void> {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env["DATABASE_URL"] }),
  });
  try {
    const printer = await prisma.printer.create({
      data: {
        id: "p_prn02_client_smoke",
        name: "Client smoke XP-C260M",
        // default model (XP_C260M / DB value "XP-C260M" via @map)
        defaultTransport: PrintTransport.WIFI,
        paperWidthMm: 80,
        printableDots: 576,
        capabilities: {
          partialCut: false,
          nativeQr: false,
          nativeBarcode: false,
          pdf417: false,
          nvLogo: false,
          buzzer: false,
          statusQuery: false,
          cashDrawer: false,
          blackMark: false,
        },
      },
    });
    if (printer.model !== "XP_C260M") {
      throw new Error(`printer.model round-trip mismatch: ${String(printer.model)}`);
    }

    const job = await prisma.printJob.create({
      data: {
        id: "pj_prn02_client_smoke",
        printerId: printer.id,
        kind: "QUOTATION",
        documentId: "pay_prn02_rehearsal",
        documentNo: "QT-REH-SMOKE",
        documentRevision: 1,
        sourcePaymentId: "pay_prn02_rehearsal",
        sourceStatus: "UNPAID",
        sourceRevision: 1,
        amountMinor: 12345,
        snapshotHasPaymentQr: true,
        snapshot: { kind: "QUOTATION" },
        snapshotHash: "sha256-smoke",
        renderVersion: "render-v1",
        requestedById: "u_prn02_rehearsal",
        selectedTransport: PrintTransport.WIFI,
        idempotencyKey: "req-rehearsal-smoke",
        timeline: [{ at: new Date().toISOString(), status: PrintJobStatus.QUEUED, note: null }],
      },
    });
    if (job.status !== PrintJobStatus.QUEUED) {
      throw new Error(`printJob.status round-trip mismatch: ${String(job.status)}`);
    }
    if (job.fencingToken !== null) {
      throw new Error("fencingToken should start as NULL");
    }

    console.log(
      "PRN02_OK: client smoke round-trip passed (printer model enum mapped value accepted, print job created)",
    );
  } finally {
    await prisma.printJob.deleteMany({ where: { id: "pj_prn02_client_smoke" } });
    await prisma.printer.deleteMany({ where: { id: "p_prn02_client_smoke" } });
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("PRN02_FAIL: client smoke failed:", error);
  process.exit(1);
});
