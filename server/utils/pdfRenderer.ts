// Shared browser for server-side rendering of /print/* routes.
// One Chromium process per Node worker, lazily launched on first request.
// Pages are created and closed per render to avoid cookie/DOM state leaks.

import chromium from "@sparticuz/chromium";
import puppeteer, { type Browser, type Page, type PaperFormat } from "puppeteer-core";

let _browser: Browser | null = null;
let _launching: Promise<Browser> | null = null;

async function getBrowser(): Promise<Browser> {
  if (_browser && _browser.connected) return _browser;
  if (_launching) return _launching;

  _launching = (async () => {
    chromium.setGraphicsMode = false;

    const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
    const executablePath = process.env.CHROME_EXECUTABLE_PATH
      || process.env.PUPPETEER_EXECUTABLE_PATH
      || (await chromium.executablePath());
    const args = isServerless
      ? chromium.args
      : [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--font-render-hinting=none",
      ];

    return puppeteer.launch({
      executablePath,
      headless: isServerless ? "shell" : true,
      args,
    });
  })().then((b) => {
    _browser = b;
    b.on("disconnected", () => {
      _browser = null;
      _launching = null;
    });
    return b;
  }).finally(() => {
    _launching = null;
  });

  return _launching;
}

// Close the browser when Nitro shuts down so we don't leak Chromium processes
// across hot reloads in dev.
if (import.meta.dev) {
  process.on("beforeExit", () => { void _browser?.close(); });
}

export interface RenderOptions {
  /** Absolute URL Puppeteer should navigate to (e.g. http://localhost:3000/print/...) */
  url: string;
  /** Cookie header forwarded from the original request so auth-protected
   *  /print/* routes can render. */
  cookieHeader?: string | undefined;
  /** Viewport width in CSS pixels (= printer dot count, e.g. 576 for 80mm). */
  width: number;
  /** Device pixel ratio. Default 3 — gives a 3× super-sampled bitmap that we
   *  later downsample to the printer's native dot grid for crisp glyph edges.
   *  Higher = sharper but memory grows quadratically. */
  deviceScaleFactor?: number;
}

// We deliberately don't call page.setCookie — Chromium's CDP validator
// rejects various legitimate cookie values (BetterAuth tokens, percent-encoded
// chars, etc.) with "Invalid cookie fields" and aborts the whole request.
// Forwarding the raw Cookie header via setExtraHTTPHeaders sidesteps the
// validator entirely — Chromium just sends the header on outgoing requests.

async function withPage<T>(opts: RenderOptions, fn: (page: Page) => Promise<T>): Promise<T> {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setViewport({
      width: opts.width,
      height: 800, // initial guess; PDF/PNG re-measures actual content
      deviceScaleFactor: opts.deviceScaleFactor ?? 3,
    });

    if (opts.cookieHeader) {
      await page.setExtraHTTPHeaders({ Cookie: opts.cookieHeader });
    }

    const response = await page.goto(opts.url, { waitUntil: "domcontentloaded", timeout: 30_000 });
    const status = response?.status();
    if (status && status >= 400) {
      throw new Error(`Print page failed with HTTP ${status}`);
    }

    await page.waitForSelector(".receipt-document", { timeout: 10_000 });
    // Wait for webfonts (Thai fallback chain) to finish loading; otherwise
    // Puppeteer can snapshot before glyphs swap in. Function runs in browser
    // context — the unbound `document` is the page's DOM, not Node's.
    await page.evaluate("document.fonts ? document.fonts.ready : Promise.resolve()");

    return await fn(page);
  } finally {
    await page.close().catch(() => {});
  }
}

export async function renderPdf(opts: RenderOptions): Promise<Buffer> {
  return withPage(opts, async (page) => {
    // Measure actual content height so the PDF page fits exactly.
    const height = (await page.evaluate("document.documentElement.scrollHeight")) as number;
    const buf = await page.pdf({
      width: `${opts.width}px`,
      height: `${height}px`,
      printBackground: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
      preferCSSPageSize: true,
      // Disables the browser's "shrink to fit" heuristic so the PDF page is
      // exactly width×height and never auto-zoomed down.
      scale: 1,
    });
    return Buffer.from(buf);
  });
}

export async function renderPng(opts: RenderOptions): Promise<Buffer> {
  return withPage(opts, async (page) => {
    // .print-frame has the exact width set per-paper-size; .receipt-document
    // is the inner content. Capture the frame so screenshots include any
    // outer padding the layout wants.
    const handle = await page.$(".print-frame") || await page.$(".receipt-document") || await page.$("body");
    if (!handle) throw new Error("Print target element not found");
    const buf = await handle.screenshot({
      type: "png",
      omitBackground: false,
      captureBeyondViewport: true,
    });
    return Buffer.from(buf);
  });
}

export const _internalRendererState = {
  isLaunched: () => Boolean(_browser?.connected),
};

// PaperFormat is re-exported only so external code can pass typed values.
export type { PaperFormat };
