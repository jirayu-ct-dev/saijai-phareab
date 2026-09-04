// GET /api/admin/payments/:id/document
//   ?type=receipt|quotation       (default: receipt)
//   &format=pdf|png|escpos        (default: pdf)
//   &width=576|384                (printer dot count for png/escpos; default 576)
//   &thaiStrategy=native-cp874|native-thai-255|raster-thai
//                                  (ESC/POS only; default: raster-thai)
//
// PDF and PNG render the authenticated /print/* view through Puppeteer.
// ESC/POS uses the current server-owned PrintDocument and Hybrid renderer.

import { requireRole } from "~~/server/utils/auth";
import { z } from "zod/v4";
import { renderPdf, renderPng } from "~~/server/utils/pdfRenderer";
import { loadCurrentDirectPrintDocument } from "~~/server/utils/directPrintDocument";
import { renderDirectEscpos } from "~~/server/utils/directPrintRenderer";
import { debugPrintBytes, toPrintResponseBuffer } from "~~/server/utils/printBinary";

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, "");
const querySchema = z.object({
  type: z.enum(["receipt", "quotation"]).default("receipt"),
  format: z.enum(["pdf", "png", "escpos"]).default("pdf"),
  width: z.coerce.number().pipe(z.union([z.literal(384), z.literal(576)])).default(576),
  thaiStrategy: z.enum(["native-cp874", "native-thai-255", "raster-thai"])
    .default("raster-thai"),
}).strict();
const idSchema = z.string().min(1).max(100).regex(/^[A-Za-z0-9_-]+$/);

export default defineEventHandler(async (event) => {
  requireRole(event, ["ADMIN", "EMPLOYEE"]);

  const idResult = idSchema.safeParse(String(event.context.params?.id ?? ""));
  if (!idResult.success) throw createError({ statusCode: 400, statusMessage: "Invalid payment id" });
  const id = idResult.data;
  const { type, format, width, thaiStrategy } = await getValidatedQuery(event, querySchema.parse);

  // On a long-running Node server, INTERNAL_BASE_URL can point Puppeteer to a
  // local Nuxt listener. On Vercel there is no localhost:3000 listener inside
  // the function, so fall back to the production origin instead.
  const internalBase = (!process.env.VERCEL && process.env.INTERNAL_BASE_URL)
    || process.env.BETTER_AUTH_URL
    || getRequestURL(event).origin;
  const url = `${trimTrailingSlash(internalBase)}/print/payment/${encodeURIComponent(id)}/${type}?w=${width}`;

  const cookieHeader = getRequestHeader(event, "cookie");

  const renderOpts = { url, cookieHeader, width } as const;

  try {
    if (format === "pdf") {
      const buf = await renderPdf(renderOpts);
      setHeader(event, "Content-Type", "application/pdf");
      setHeader(event, "Content-Disposition", `inline; filename="${type}-${id}.pdf"`);
      return buf;
    }

    if (format === "png") {
      const buf = await renderPng(renderOpts);
      setHeader(event, "Content-Type", "image/png");
      setHeader(event, "Content-Disposition", `inline; filename="${type}-${id}.png"`);
      return buf;
    }

    // Direct Hybrid output is built from current server-owned data. The
    // browser supplies only the payment id, document kind and safe width.
    const document = await loadCurrentDirectPrintDocument({
      paymentId: id,
      kind: type === "receipt" ? "RECEIPT" : "QUOTATION",
    });
    const { bytes } = await renderDirectEscpos(document, width, thaiStrategy);
    await debugPrintBytes("A_RENDERER", bytes);
    setHeader(event, "Content-Type", "application/octet-stream");
    setHeader(event, "Content-Disposition", `attachment; filename="${type}-${id}.bin"`);
    const responseBody = toPrintResponseBuffer(bytes);
    await debugPrintBytes("B_ENDPOINT", responseBody);
    return responseBody;
  } catch (e) {
    if (e && typeof e === "object" && "statusCode" in e) throw e;
    const message = e instanceof Error ? e.message : String(e);
    const stack = e instanceof Error ? e.stack : undefined;
    // Full render context (internal URL, stack) stays in the server log; the
    // client only gets a generic message so internal topology is not leaked.
    console.error("[document.get] render failed:", { url, format, message, stack });
    throw createError({
      statusCode: 500,
      statusMessage: "ไม่สามารถสร้างเอกสารได้ กรุณาลองอีกครั้ง",
    });
  }
});
