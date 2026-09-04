# Saijai Printing Operations and Verification

Use this reference for daily operation, replacing a printer, validating changes, and diagnosing failures.

## Daily operator flow

1. Open the relevant admin receipt or quotation.
2. If no printer is connected, open the connection modal.
3. Prefer **Wi-Fi / Ethernet** for the shared counter printer. USB and Bluetooth remain available as fallback.
4. If the previously selected trusted printer is online, select it or allow the single-printer auto-selection.
5. Press print once.
6. Interpret the result conservatively:
   - `SENT`: transport completed; visually confirm critical paper output when needed;
   - `BUSY`: another attempt owns the printer; wait and press again manually;
   - `NOT_CONNECTED`, `OFFLINE`, `TIMEOUT`: restore connection, then retry deliberately;
   - `UNKNOWN_PROGRESS`: bytes may have reached the printer. Check the physical printer and paper before choosing to print again.

There is no background queue. Closing the page does not leave a server print job waiting.

## Replacing a failed printer

### Same reserved IP and port

If the replacement is configured with the same confirmed IP and port, connect it to the same shop network and check Gateway health/printer status. No code, database, or application setting should need changing.

### Different IP or port

1. Record the new unit label and self-test/configuration page.
2. Confirm its private IP, MAC, raw-print protocol, port, paper width, and hardware revision.
3. Create or update the router DHCP reservation.
4. Update only the Gateway host's `PRINT_GATEWAY_DISCOVERY_CIDRS` and/or `PRINT_GATEWAY_DISCOVERY_PORTS`.
5. Validate Compose and recreate the Gateway so it reads the new environment.
6. In the app, connect by Wi-Fi/Ethernet and force discovery.
7. If the old trusted printer is the only saved printer and is offline, selecting the new candidate replaces the old endpoint while preserving its opaque ID.
8. Run the physical verification ladder before normal receipts resume.

Never edit source code merely to change printer IP. Never add printer rows to PostgreSQL for this flow.

## Verification ladder

Separate software-only checks from physical actions.

### Software-only checks

These do not scan the real LAN or print paper when they use the committed fake configuration:

```bash
pnpm exec vitest run \
  tests/server/printBridgeDirectConfig.test.ts \
  tests/server/printBridgeDirectServer.test.ts \
  tests/server/printBridgeTransport.test.ts \
  tests/server/printGatewayDiscovery.test.ts \
  tests/server/printGatewayState.test.ts \
  tests/server/directPrintDocument.test.ts \
  tests/server/directPrintRenderer.test.ts \
  tests/shared/directPrint.test.ts \
  tests/shared/escpos.test.ts \
  tests/shared/printComposer.test.ts \
  tests/shared/printingContracts.test.ts

pnpm exec nuxi typecheck
docker compose -f docker-compose.print-gateway.yml config --quiet
```

Run `pnpm run build` when changing Nuxt runtime configuration, Docker build inputs, server rendering, or deployment behavior. There is no working lint command in this repository.

### Minimal Thai raster fixture

Before sending anything to physical hardware, generate the software-only
fixture at an absolute writable path:

```bash
pnpm print:test-receipt -- /tmp/xp-c260m-minimal-raster.bin
```

The fixture contains `ESC @`, a 288-dot raster block for `TEST 123`, a raster
block for `ทดสอบไทย`, and two feed lines. It contains no QR and no cut command.
Its reported `rasterWidthBytes` must be `36` because `GS v 0` encodes width in
bytes per row, not dots. Record `byteLength`, `sha256`, `rasterWidthDots`,
`rasterWidthBytes`, and `cut`; expected structural values are 288 dots, 36
bytes, and `cut=false`.

Only after the fixture is structurally valid and the physical target is
explicitly authorized should it be sent to the confirmed raw TCP endpoint.
The paper must show readable `TEST 123` and `ทดสอบไทย` without binary garbage.
Then verify a real receipt with combining marks (`น้ำ`, `กุ้ง`, `ไข่`, `ข้าว`),
mixed receipt numbers/phone/amounts, center and right alignment, wrapping, and
no Chinese glyphs or native Thai UTF-8 bytes.

For byte-boundary diagnosis in development only, set `PRINT_DEBUG_BYTES=true`
on Nuxt and `PRINT_GATEWAY_DEBUG_BYTES=true` on the Gateway. Compare
`byteLength`, `sha256`, and `first32Hex` at each stage and stop at the first
boundary whose hash changes. Never enable byte previews in production because
they can contain receipt text.

### Network checks

Network probing requires an explicitly identified target and permission for that shop network. Stop after the narrowest useful check:

1. read the printer configuration page;
2. confirm Gateway host and printer are on routable LANs without client isolation/VLAN blocking;
3. check the confirmed address;
4. check only the confirmed print port;
5. confirm `/health`, LAN source/origin checks, discovery, trust, and online status without sending print bytes.

Do not broaden `/32` to `/24`, scan arbitrary ports, or probe unrelated hosts merely because discovery is available.

### Physical checks

Each step affects real hardware and requires explicit authorization for the target:

1. minimal ASCII receipt, feed only, no cut;
2. Thai text containing vowels, tone marks, mixed Latin/numbers, long names, and wrapping;
3. receipt totals and alignment at the confirmed width;
4. amount-specific payment QR scanned by the intended banking application;
5. LINE QR scanned by the intended phone;
6. repeated manual jobs and a deliberate busy/concurrent attempt;
7. offline, reconnect, and timeout handling;
8. confirm the established four-line feed and single trailing partial cut;
   physical cutter testing still requires explicit authorization for the target.

Record model/revision, firmware, interface, IP or queue, port, paper width, printable dots, render mode, test date, and capabilities that passed. Redact secrets, token values, Wi-Fi credentials, customer data, and unnecessary internal-network detail from shared reports.

## Diagnosis by layer

```text
Printer mechanism
  -> physical interface/link
  -> Gateway reachability and TLS
  -> origin and LAN source check
  -> discovery/trusted target
  -> TCP transport
  -> ESC/POS bytes
  -> Hybrid Thai/QR rendering
  -> application document data
```

Useful observations:

- Gateway unavailable: check container/process, publish/bind host, DNS, certificate trust, firewall, and exact browser origin.
- Discovery finds nothing: verify the physical IP/port, allowlist, VLAN/client isolation, and discovery TTL. Do not assume port `9100`.
- Trusted printer offline: probe only its confirmed endpoint and check cable/Wi-Fi/link indicators, DHCP reservation, paper/cover/error state.
- `BUSY`: another immediate attempt holds the per-printer mutex; it is not a queued job.
- `UNKNOWN_PROGRESS`: inspect paper before retrying.
- ASCII works but Thai is wrong: the inspected firmware already failed its
  physical Page 70 / CP874 test. Confirm the application used the default
  Prompt-font raster path, remained within 576 dots, and emitted bounded
  `GS v 0` bands. Page 70 and Page 255 are diagnostic-only and must not be
  restored as production defaults without new physical evidence.
- QR does not scan: check amount/payload correctness, contrast, physical module size, quiet zone, paper quality, and thermal density.
- Receipt is clipped: confirm 576 versus 384 dots and the physical printable width.
- Paper prints but does not cut: confirm the rendered payload ends with exactly
  `1B 64 04 1D 56 42 00` (feed four lines, partial cut), then isolate transport
  truncation, cutter mode/jam, and firmware command compatibility. Do not fire
  repeated standalone cut commands.
- Receipt content is incomplete: compare `buildPaymentDocumentPayload` and the
  canonical receipt/quotation Vue component with `directPaymentInclude`,
  `buildPrintDocument`, and composed text. Check query selection, fallback
  conditions, explicit newlines, long-text wrapping, raster-band sizes, and
  that the cut bytes occur only after all content.

Use [troubleshooting.md](troubleshooting.md) for deeper device and transport isolation.

## Logs and evidence

Gateway logging is intentionally sanitized. Keep error codes and lifecycle facts, not payload bytes, IP inventories, QR receiver values, or receipt/customer contents. A transport success is evidence of delivery to the socket boundary only.

When handing work to another agent, state:

- whether the target is fake/local or physical;
- which external actions are authorized;
- confirmed device/network facts versus open assumptions;
- exact checks already run and their results;
- whether any result was `UNKNOWN_PROGRESS`;
- whether Docker volume/state must be preserved.

## Operations that require a separate decision

Do not infer permission for any of these from a request to edit code or documentation:

- scanning a real subnet or connecting to a physical printer;
- printing a test page, feeding/cutting paper, or opening a cash drawer;
- changing printer/router network settings or DHCP reservations;
- deleting Gateway state or removing trusted printer mappings;
- exposing a Gateway or raw printer port;
- factory reset or firmware update.

Firmware update and factory reset are last-resort maintenance. Capture current configuration, identify the exact hardware revision, obtain matching vendor material, confirm stable power, and obtain explicit authorization before either action.
