import { z } from "zod";
import { prisma } from "~~/server/utils/prisma";
import { requireBridgePrinter } from "~~/server/utils/printJobQueue";

const bodySchema = z.object({
  printerId: z.string().min(1),
  bridgeVersion: z.string().trim().min(1).max(50),
});

// PRN-03: bridge heartbeat. Auth = bridge credential (no user session); the
// bearer token is verified in-handler and never logged.
export default defineEventHandler(async (event) => {
  const body = await readValidatedBody(event, bodySchema.parse);
  const printer = await requireBridgePrinter(prisma, event, body.printerId);

  const now = new Date();
  await prisma.printer.update({
    where: { id: printer.id },
    data: { lastHeartbeatAt: now, bridgeVersion: body.bridgeVersion },
  });

  return { ok: true, serverTime: now.toISOString() };
});
