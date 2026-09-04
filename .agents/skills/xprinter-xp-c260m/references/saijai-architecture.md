# Saijai Phareab Printing Architecture

Read this reference before changing printing in the Saijai Phareab repository. It describes implemented behavior, not a future design proposal.

## Product decision

Saijai prints receipts and quotations immediately. It has no database-backed printer registry, print-job queue, background worker, or automatic retry. A user connects a printer, presses print, and receives the result of that single attempt.

This is intentional:

- a second attempt while the same printer is busy returns `BUSY` instead of waiting;
- failures before sending can be reported as offline, timeout, or not connected;
- after sending begins, a transport failure becomes `UNKNOWN_PROGRESS` because some bytes may already have reached the printer;
- the application must not retry `UNKNOWN_PROGRESS` automatically because that can create duplicate receipts;
- `SENT` means the bytes were handed to the transport. It does not prove that paper was printed, cut, or collected.

The database stores business data and shop/QR settings, not printer connection state. Printer connection settings belong to the Gateway host environment and Gateway state file. Browser selection lives in browser local storage.

## Implemented paths

```text
Current payment + AppSetting
        |
        v
Nuxt admin document endpoint
        |
        v
server-owned PrintDocument -> Hybrid ESC/POS bytes
        |
        +--> LAN: browser -> HTTPS Print Gateway -> trusted private TCP target -> XP-C260M
        |
        +--> USB: browser -> WebUSB bulk OUT -> printer
        |
        `--> Bluetooth: browser -> Web Bluetooth characteristic -> printer
```

The supported application transports are:

| UI label | Application path | Persistent selection |
| --- | --- | --- |
| Wi-Fi / Ethernet | Browser calls the shop LAN Print Gateway; Gateway opens the printer TCP socket | Selected opaque printer ID in browser local storage; trusted target in Gateway state |
| USB | Browser writes to a claimed WebUSB bulk OUT endpoint | Browser permission may allow reconnect; no server record |
| Bluetooth | Browser writes 20-byte chunks to a supported BLE characteristic | Connection is session/device dependent; no server record |

USB and Bluetooth fallback remain available without a feature flag.

## Canonical print flow

1. An admin or employee requests `/api/admin/payments/:id/document` with `format=escpos`, document type, and a safe width of `576` or `384` dots.
2. The endpoint enforces the admin/employee role and loads the current payment plus settings in one transaction. It does not create a PrintJob.
3. `loadDirectPrintDocument` creates a server-owned `PrintDocument`. The browser supplies only payment ID, document kind, and allowed width; it does not supply totals, QR receiver data, printer host, or port.
4. `renderDirectEscpos` creates Hybrid output:
   - ASCII-only text remains native ESC/POS;
   - every text block containing Thai, including mixed Thai/Latin/numbers,
     defaults to raster rendered with the bundled Prompt font;
   - the physical unit printed incorrect glyphs with Page 70 / CP874, so Page
     70 and Page 255 remain diagnostic-only strategies, never defaults;
   - payment QR is generated from the server-owned amount-specific payload and rasterized;
   - LINE QR is fetched only from HTTPS `res.cloudinary.com`, bounded to 2 MB, then rasterized;
   - safe ASCII and layout operations remain ESC/POS commands;
   - raster output is split into bounded bands, each with its own `GS v 0`
     header; `xL/xH` is bytes per row (`576 dots = 72 bytes`), never dots;
   - the confirmed cutter is emitted once as `GS V 66 0`, after four feed
     lines and after every text/raster/QR/footer byte;
   - all other optional hardware features remain disabled until the physical
     unit proves them.
5. `executeDirectPrint` acquires a process-local immediate-attempt mutex, loads bytes only after a transport is connected, and calls the transport once. It never queues or retries.
6. For LAN printing, the browser sends `application/octet-stream` to `/print/:opaquePrinterId`. The Gateway resolves the trusted target locally and serializes per printer.

Paper profiles currently map `80 mm -> 576 dots` and `58 mm -> 384 dots`. The XP-C260M target is normally 80 mm, but the actual unit self-test must confirm active printable width before relying on 576 dots.

## LAN Print Gateway trust boundary

The Gateway is a local service on a trusted shop host. It must not be confused with the public Nuxt server or the printer itself.

```text
Public app origin:     https://saijaiphareab.shop
Shop Gateway origin:  stable trusted HTTPS origin reachable from shop browsers
Printer endpoint:     private IPv4 + confirmed raw-print protocol/port
```

Security properties implemented by `print-bridge/`:

- exact-origin CORS; wildcard origins are rejected;
- non-loopback Gateway URLs require HTTPS and both certificate paths;
- no pairing code or bearer token is used; the private shop LAN is the trust
  boundary and only private/loopback source addresses are accepted;
- `/discover` scans only configured private or loopback IPv4 CIDRs from `/24` through `/32`, with at most 4,096 address/port targets;
- discovery returns opaque candidate IDs, never an IP or port to the browser;
- `/printers/trust` resolves the candidate inside the Gateway before saving it;
- `/print/:id` accepts only an already trusted printer ID and a bounded binary payload;
- discovery and printing are rate-limited per client source address;
- the state file is owner-only and written atomically;
- Docker runs read-only, drops Linux capabilities, applies `no-new-privileges`, and persists state in `saijai-print-gateway-state`.

Do not add an API that accepts an arbitrary browser-supplied IP or port. That would weaken the SSRF and internal-network boundary.

The Gateway intentionally trusts users on the shop network. Exact-origin checks
protect normal browser calls but are not authentication against a local script
that spoofs the `Origin` header. Keep the Gateway unreachable from public and
guest networks. Do not deploy it where the local network cannot be trusted.

## Printer replacement behavior

Trusted printers use an opaque stable ID. When the UI sees exactly one trusted printer and it is offline, trusting a newly discovered candidate sends `replacesPrinterId`; the Gateway keeps the existing ID and replaces only the locally stored host/port/name mapping. Existing browser selection therefore continues to work.

If a replacement printer receives the same DHCP-reserved IP and uses the same verified port, the Gateway should see it online without code or database changes. If IP or port changes, update the Gateway discovery allowlist, restart/recreate the Gateway for environment changes, discover the new candidate, and confirm replacement in the UI.

## QR settings are separate

Shop, LINE QR, and payment QR configuration remains under `admin/settings/shop` and is stored in the singleton application settings. Payment QR is generated from the exact payment amount on the server. Printer connectivity, IP, port, and trusted-printer state must not be moved into those database settings.

The receipt/quotation logo is the committed public asset
`public/logo-saijai-phareab.png`. Both the browser document and direct-print
renderer use that asset; direct printing converts it to a centered monochrome
raster block before the shop heading. Do not use Cloudinary or program an NV
logo slot for this logo unless the product decision changes.

Payment QR uses a shop PromptPay mobile number configured by an administrator
on the same settings page. The full number is encrypted at rest with the
server-only `PAYMENT_QR_RECEIVER_KEYS` keyring; admin reads expose only the last
four digits. The server generates and validates a dynamic amount-bound QR only
for positive, `UNPAID` quotations. The same validated payment block is rendered
on admin, customer, PDF/PNG and direct-print quotation views. Receipts never carry a payment QR. Keep this
distinct from the uploaded LINE QR shown on receipts. A LINE QR image is itself
the display setting: when the image exists it is shown, and removing the image
hides it. Both payment and LINE QR raster blocks are padded to the full printable
width so they remain centered on 80 mm and 58 mm paper.

## Source-of-truth files

Inspect these before modifying behavior:

| Concern | Source |
| --- | --- |
| Browser connection and one-attempt send | `app/composables/useThermalPrinter.ts` |
| Connection modal and replacement UX | `app/components/thermal/PrinterConnectModal.vue` |
| Document authorization and binary endpoint | `server/api/admin/payments/[id]/document.get.ts` |
| Current payment/settings snapshot | `server/utils/directPrintDocument.ts` |
| Receipt/quotation field mapping | `server/utils/printDocument.ts`, compared with `app/components/print/ReceiptDocument.vue` and `QuotationDocument.vue` |
| Hybrid Thai/QR/ESC-POS rendering | `server/utils/directPrintRenderer.ts` |
| Immediate attempt and ambiguous-failure contract | `shared/utils/directPrint.ts`, `shared/types/printing.ts` |
| ESC/POS composition and encoding | `shared/utils/printComposer.ts`, `shared/utils/escpos.ts` |
| Gateway configuration and safety bounds | `print-bridge/config.mjs` |
| Gateway LAN checks, discovery, trust, and print API | `print-bridge/discovery.mjs`, `server.mjs`, `state.mjs` |
| TCP transport | `print-bridge/transport/tcp.js` |
| Docker deployment | `docker-compose.print-gateway.yml`, `docker-compose.print-gateway.production.yml` |
| Environment template | `.env.example` |

If prose conflicts with executable code or focused tests, report the inconsistency and use code/tests as current behavior until the documentation is deliberately reconciled.

## Change invariants

- Preserve all three connection modes unless the user explicitly narrows scope.
- Keep receipt business data and QR payload construction server-owned.
- Keep printer targets Gateway-owned and opaque to the browser.
- Preserve immediate-send, no-wait, no-automatic-retry behavior unless the user explicitly changes the product decision.
- Keep `raster-thai` as the production default. A physical test on firmware
  `7.022PROY` disproved the native Page 70 / CP874 path. Keep both native code
  pages diagnostic-only unless later physical evidence deliberately changes
  this decision.
- Never equate socket completion with physical print completion.
- Partial cut is enabled for the inspected XP-C260M because its self-test
  confirms the cutter. Keep it as exactly one command at the tail of one
  document payload, after tear-off feed. Native QR, native barcode, cash
  drawer, buzzer, status query, black mark, and other optional capabilities
  remain disabled until separately verified.
- A code change, LAN scan, test print, cut, reset, network reconfiguration, or firmware update are different authorities. Ask for the missing authority immediately before the physical or external action.

## Receipt and quotation content contract

`PrintDocument` is narrower than the full payment API but must retain the
business facts already shown by the canonical web document. Before changing
it, compare both paths field by field. The implemented direct-print mapping
includes, when present:

- shop name/address/phone, document number and original creation time;
- customer name/phone, order number, received/due/completed time, employee,
  payment method and confirmed/paid time;
- every non-deleted item, quantity, unit price, line total, item note and
  package main/add-on label;
- item count, weight/rate, hanger count/charge, subtotal, discount, VAT and
  final payment amount;
- payment/package/order note fallback, active add-on usages, member package
  usage history/balance/expiry, document-specific footer, and eligible QR.

Values must come from the payment/settings transaction. Empty optional data is
omitted or uses the established web-document fallback; never invent it. Keep
explicit newlines and wrap long text into bounded raster bands.

The direct printer mirrors the canonical thermal layout with semantic blocks:
information and summary values use left/right anchors, item rows use four
paper-relative anchors (item, unit price, quantity, total), and the final total
uses a larger left/right row. Structured item rows are rasterized even when a
particular row is ASCII-only so their geometry cannot drift with the printer's
native font. Long item names wrap only inside the first column; numeric columns
remain top-aligned and right-anchored. The receipt is still rendered block by
block rather than as one tall image.
