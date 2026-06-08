// GET /api/admin/payments/:id/document
//   ?type=receipt|quotation       (default: receipt)
//   &format=pdf|png|escpos        (default: pdf)
//   &width=576|384                (printer dot count for png/escpos; default 576)
//
// Single endpoint that renders the /print/* route via Puppeteer and returns
// the requested format. The PDF is the source of truth — PNG is the same view
// captured as a screenshot, and ESC/POS bytes are produced from the PNG.

import { requireRole } from "~~/server/utils/auth";
import { renderPdf, renderPng } from "~~/server/utils/pdfRenderer";
import { buildEscposBytes } from "~~/server/utils/escposRaster";

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, "");

export default defineEventHandler(async (event) => {
  requireRole(event, ["ADMIN", "EMPLOYEE"]);

  const id = String(event.context.params?.id ?? "");
  if (!id) throw createError({ statusCode: 400, statusMessage: "Missing payment id" });

  const q = getQuery(event);
  const type = q.type === "quotation" ? "quotation" : "receipt";
  const format = q.format === "png" ? "png" : q.format === "escpos" ? "escpos" : "pdf";
  const width = (() => {
    const n = Number(q.width);
    if (n === 384) return 384;
    return 576;
  })();

  // On a long-running Node server, INTERNAL_BASE_URL can point Puppeteer to a
  // local Nuxt listener. On Vercel there is no localhost:3000 listener inside
  // the function, so fall back to the production origin instead.
  const internalBase = (!process.env.VERCEL && process.env.INTERNAL_BASE_URL)
    || process.env.BETTER_AUTH_URL
    || getRequestURL(event).origin;
  const url = `${trimTrailingSlash(internalBase)}/print/payment/${id}/${type}?w=${width}`;

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

    // escpos — render PNG first, then convert to printer bytes
    const pngBytes = await renderPng(renderOpts);
    const bytes = await buildEscposBytes({
      pngBytes,
      paperWidth: width === 384 ? 58 : 80,
    });
    setHeader(event, "Content-Type", "application/octet-stream");
    setHeader(event, "Content-Disposition", `attachment; filename="${type}-${id}.bin"`);
    return bytes;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    const stack = e instanceof Error ? e.stack : undefined;
    // Surface to server log AND response so 500s are diagnosable in prod.
    console.error("[document.get] render failed:", { url, format, message, stack });
    throw createError({
      statusCode: 500,
      statusMessage: message,
      data: { url, format, message },
    });
  }
});
