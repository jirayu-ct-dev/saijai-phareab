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
  name: z.string().trim().min(1, "กรุณาตั้งชื่อเครื่องพิมพ์").max(100),
  defaultTransport: z.enum(["WIFI", "ETHERNET", "USB", "BLUETOOTH"]),
  paperWidthMm: z.union([z.literal(80), z.literal(58)]),
  printableDots: z.union([z.literal(576), z.literal(512), z.literal(384)]),
  renderMode: z.enum(["RASTER", "HYBRID"]).default("HYBRID"),
  capabilities: capabilitiesSchema,
  isActive: z.boolean().optional(),
});

// PRN-03 v1: exactly one logical printer (C7). This endpoint creates it; a
// second create returns 409 — updates go through the same UI flow later.
export default defineEventHandler(async (event) => {
  requireRole(event, ["EMPLOYEE", "ADMIN"]);
  const body = await readValidatedBody(event, bodySchema.parse);

  const existing = await prisma.printer.findFirst({ where: { deletedAt: null }, select: { id: true } });
  if (existing) {
    throw createError({
      statusCode: 409,
      statusMessage: "มีเครื่องพิมพ์ลงทะเบียนอยู่แล้ว (รองรับเครื่องเดียวในเวอร์ชันนี้)",
    });
  }

  const printer = await prisma.printer.create({
    data: {
      name: body.name,
      defaultTransport: body.defaultTransport,
      paperWidthMm: body.paperWidthMm,
      printableDots: body.printableDots,
      renderMode: body.renderMode,
      capabilities: createPrinterCapabilities(body.capabilities ?? {}),
      isActive: body.isActive ?? true,
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
