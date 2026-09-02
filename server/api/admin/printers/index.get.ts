import { requireRole } from "~~/server/utils/auth";
import { prisma } from "~~/server/utils/prisma";

// PRN-03: safe printer list — never connectionProfile, never credential hash.
export default defineEventHandler(async (event) => {
  requireRole(event, ["EMPLOYEE", "ADMIN"]);

  const printers = await prisma.printer.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      model: true,
      defaultTransport: true,
      paperWidthMm: true,
      printableDots: true,
      renderMode: true,
      capabilities: true,
      isActive: true,
      lastHeartbeatAt: true,
      bridgeVersion: true,
      bridgeCredentialVersion: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return { printers };
});
