import { z } from "zod";
import { prisma } from "~~/server/utils/prisma";
import { printerProfileFromPrinterRow, claimPrintJobs, requireBridgePrinter } from "~~/server/utils/printJobQueue";

const bodySchema = z.object({
  printerId: z.string().min(1),
  maxJobs: z.number().int().min(1).max(5).optional(),
});

// PRN-03: bridge claim. Auth = bridge credential (no user session). The claim
// runs in ONE transaction with FOR UPDATE SKIP LOCKED and C9 freshness
// validation (stale jobs end as STALE_DOCUMENT, never printed).
export default defineEventHandler(async (event) => {
  const body = await readValidatedBody(event, bodySchema.parse);
  await requireBridgePrinter(prisma, event, body.printerId);

  // Compose with the printer's current profile (nativeQr capability decides
  // the payment-QR operation path; no bitmap provider server-side).
  const printerRow = await prisma.printer.findFirstOrThrow({
    where: { id: body.printerId },
  });
  const printerProfile = printerProfileFromPrinterRow(printerRow);

  const jobs = await claimPrintJobs(prisma, {
    printerId: body.printerId,
    printerProfile,
    maxJobs: body.maxJobs,
  });

  return { jobs };
});
