import { z } from "zod";
import { requireRole } from "~~/server/utils/auth";
import { prisma } from "~~/server/utils/prisma";
import { projectPrintJob } from "~~/server/utils/printJobQueue";

const querySchema = z.object({
  status: z
    .enum([
      "QUEUED",
      "CLAIMED",
      "RENDERING",
      "READY",
      "SENDING",
      "SENT",
      "ACKNOWLEDGED",
      "RETRY_WAIT",
      "STALE_DOCUMENT",
      "NEEDS_REVIEW",
      "RESOLVED_PRINTED",
      "RESOLVED_NOT_PRINTED",
      "REPRINTED",
      "FAILED",
    ])
    .optional(),
  printerId: z.string().min(1).optional(),
  take: z.coerce.number().int().min(1).max(100).default(20),
});

// PRN-03: JSON-safe job list. Snapshot payloads never appear in list views —
// only hashes, counts and the bounded timeline.
export default defineEventHandler(async (event) => {
  requireRole(event, ["EMPLOYEE", "ADMIN"]);
  const query = await getValidatedQuery(event, querySchema.parse);

  const jobs = await prisma.printJob.findMany({
    where: {
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(query.printerId ? { printerId: query.printerId } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: query.take,
  });

  return { jobs: jobs.map(projectPrintJob) };
});
