import { z } from "zod";
import { prisma } from "~~/server/utils/prisma";
import { PRINT_BRIDGE_EVENT_TYPES, applyPrintJobEvent, requireBridgePrinter } from "~~/server/utils/printJobQueue";

const eventSchema = z.object({
  jobId: z.string().min(1),
  leaseToken: z.string().min(1),
  fencingToken: z.number().int().min(0),
  type: z.enum(PRINT_BRIDGE_EVENT_TYPES),
  failureCode: z.string().trim().min(1).max(50).optional(),
  failureMessageSafe: z.string().trim().min(1).max(500).optional(),
});

const bodySchema = z.object({
  printerId: z.string().min(1),
  events: z.array(eventSchema).min(1).max(20),
});

// PRN-03: bridge lifecycle events. Auth = bridge credential (no user session).
// Every event must carry the job's CURRENT leaseToken AND fencingToken; each
// event is applied atomically and reported individually.
export default defineEventHandler(async (event) => {
  const body = await readValidatedBody(event, bodySchema.parse);
  await requireBridgePrinter(prisma, event, body.printerId);

  const results = [];
  for (const bridgeEvent of body.events) {
    results.push(
      await applyPrintJobEvent(prisma, { printerId: body.printerId, event: bridgeEvent }),
    );
  }

  return { results };
});
