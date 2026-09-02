import { z } from "zod";
import { requireRole } from "~~/server/utils/auth";
import { prisma } from "~~/server/utils/prisma";
import { createPrinterCapabilities } from "~~/shared/utils/printJobState";

const capabilitiesSchema = z
  .object({
    partialCut: z.boolean(),
    nativeQr: z.boolean(),
    nativeBarcode: z.boolean(),
    pdf417: z.boolean(),
    nvLogo: z.boolean(),
    buzzer: z.boolean(),
    statusQuery: z.boolean(),
    cashDrawer: z.boolean(),
    blackMark: z.boolean(),
  })
  .partial()
  .optional();

const bodySchema = z.object({
  name: z.string().trim().min(1, "กรุณาตั้งชื่อเครื่องพิมพ์").max(100).optional(),
  defaultTransport: z.enum(["WIFI", "ETHERNET", "USB", "BLUETOOTH"]).optional(),
  paperWidthMm: z.union([z.literal(80), z.literal(58)]).optional(),
  printableDots: z.union([z.literal(576), z.literal(512), z.literal(384)]).optional(),
  renderMode: z.enum(["RASTER", "HYBRID"]).optional(),
  capabilities: capabilitiesSchema,
  isActive: z.boolean().optional(),
});

export default defineEventHandler(async (event) => {
  requireRole(event, ["EMPLOYEE", "ADMIN"]);
  const id = getRouterParam(event, "id");
  const body = await readValidatedBody(event, bodySchema.parse);

  const existing = await prisma.printer.findFirst({
    where: { id, deletedAt: null },
    select: { id: true, capabilities: true },
  });
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: "ไม่พบเครื่องพิมพ์นี้" });
  }

  // Partial capability updates merge onto the stored profile so a patch never
  // silently resets verified flags to their default-false values.
  const capabilities =
    body.capabilities !== undefined
      ? createPrinterCapabilities({ ...(existing.capabilities as object), ...body.capabilities })
      : undefined;

  const printer = await prisma.printer.update({
    where: { id },
    data: {
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.defaultTransport !== undefined ? { defaultTransport: body.defaultTransport } : {}),
      ...(body.paperWidthMm !== undefined ? { paperWidthMm: body.paperWidthMm } : {}),
      ...(body.printableDots !== undefined ? { printableDots: body.printableDots } : {}),
      ...(body.renderMode !== undefined ? { renderMode: body.renderMode } : {}),
      ...(capabilities !== undefined ? { capabilities } : {}),
      ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
    },
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
    },
  });

  return { printer };
});
