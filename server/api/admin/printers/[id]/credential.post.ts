import { createHash, randomUUID } from "node:crypto";
import { requireRole } from "~~/server/utils/auth";
import { prisma } from "~~/server/utils/prisma";

// PRN-03: rotate the bridge credential. The plaintext token is returned ONCE
// (this response is the only time it is ever exposed); only the SHA-256 hash
// and an incremented version are stored. The token is never logged.
export default defineEventHandler(async (event) => {
  requireRole(event, ["EMPLOYEE", "ADMIN"]);
  const id = getRouterParam(event, "id");
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: "ไม่พบเครื่องพิมพ์ที่ระบุ" });
  }

  const printer = await prisma.printer.findFirst({
    where: { id, deletedAt: null },
    select: { id: true, bridgeCredentialVersion: true },
  });
  if (!printer) {
    throw createError({ statusCode: 404, statusMessage: "ไม่พบเครื่องพิมพ์ที่ระบุ" });
  }

  const token = randomUUID();
  const hash = createHash("sha256").update(token, "utf8").digest("hex");
  const updated = await prisma.printer.update({
    where: { id: printer.id },
    data: {
      bridgeCredentialHash: hash,
      bridgeCredentialVersion: (printer.bridgeCredentialVersion ?? 0) + 1,
    },
    select: { bridgeCredentialVersion: true },
  });

  return {
    ok: true,
    credential: token,
    bridgeCredentialVersion: updated.bridgeCredentialVersion,
  };
});
