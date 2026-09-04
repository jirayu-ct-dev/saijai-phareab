# XP-C260M Integration

Use this reference when designing or implementing application printing, ESC/POS output, network transport, Thai rendering, codes, cutting, or cash-drawer behavior.

## Select the transport boundary

Choose one path and make it observable:

- **OS driver / spooler:** appropriate for desktop applications, ordinary print dialogs, and environments where the OS owns discovery and queues.
- **USB library or local service:** appropriate for a dedicated POS terminal; permissions and device ownership are platform-specific.
- **Network ESC/POS:** appropriate for shared POS and kitchen printers on a trusted LAN. Obtain the address, protocol, and port from the unit configuration.

For a web POS, use this shape:

```text
Browser UI -> authenticated backend or local print bridge -> per-printer serialization -> XP-C260M
```

Serialization may be a durable queue or an immediate-attempt mutex depending on the product's duplicate and recovery policy. Do not add a durable queue when the product deliberately prefers immediate printing and explicit human retry after ambiguous failures.

Do not let a browser-supplied arbitrary host or port become the destination. Map trusted printer identifiers to server-side allowlisted endpoints to avoid SSRF and unauthorized internal-network access.

## Build one printer adapter

Keep application code independent of raw ESC/POS bytes. Expose a narrow operation such as `printReceipt(receipt, target)` and keep these concerns inside the adapter:

- transport connection and timeouts;
- ESC/POS encoding;
- text versus raster rendering;
- paper width and layout;
- feed and cut behavior;
- job serialization and logging;
- retry and duplicate policy.

Represent the receipt as domain data before rendering. Do not build business totals, tax rules, or order state inside printer-command code.

## Compose a job deliberately

A typical job contains:

1. printer initialization when appropriate;
2. alignment, emphasis, font, and line-spacing commands;
3. text, raster images, barcode, or QR content;
4. enough feed to clear the cutter;
5. partial-cut command when the workflow requires it.

Use the command set supported by the actual firmware and the chosen library. ESC/POS compatibility does not guarantee that every Epson or vendor extension behaves identically.

## Thai output

Prefer text mode only after a physical test proves that the selected code page and firmware render Thai correctly. Test combining marks and mixed scripts, not just isolated characters.

For predictable output:

- shape and render Thai with a font that permits the intended use;
- rasterize at the confirmed width, usually 576 or 512 dots;
- convert to monochrome with suitable thresholding or dithering;
- split very tall images into manageable bands if the library or buffer requires it;
- keep important text and QR codes high contrast.

A mixed strategy can keep ASCII item data in text mode and render only Thai or complex blocks as raster, but verify alignment between the two modes physically.

## QR codes, barcodes, and images

- Prefer native commands when the firmware/library combination is verified; use raster fallback for unsupported or inconsistent cases.
- Size QR modules for 203 DPI and test with the actual scanner or payment application.
- Preserve quiet zones and avoid low-contrast logos inside payment QR codes.
- Validate barcode data and symbology constraints before sending the job.
- Scale logos to the active printable width and use monochrome assets designed for thermal output.

## Queues, retries, and status

Serialize jobs for each printer so bytes from two receipts cannot interleave. Give every application job an internal identifier and log its lifecycle without storing unnecessary receipt data.

Distinguish:

- accepted by the application;
- written to a socket or spooler;
- acknowledged by a supported status mechanism;
- physically printed and collected.

These are not equivalent. A connection closing successfully does not prove physical completion.

Use bounded connection and write timeouts. Retry only when the failure semantics make duplication acceptable or the system has an idempotent/deduplication mechanism. For kitchen orders, an obvious duplicate marker or human reconciliation path may be safer than silent automatic retry.

## Cash drawer

Opening the cash drawer is a physical side effect. Keep it as an explicit operation and send the pulse only when requested by the business flow. Verify voltage, connector pinout, pulse parameters, and printer support for the actual drawer before testing.

## Integration verification

Test on physical hardware with representative content:

- short ASCII receipt;
- Thai with vowels and tone marks;
- long item names, quantities, totals, and wrapping;
- logo and required QR/barcode;
- feed and partial cut;
- repeated jobs and concurrent requests;
- printer offline, reconnect, timeout, and queue recovery;
- application restart with pending jobs when durability is required.

Keep the network target, driver name, firmware, library version, render width, and successful test fixture recorded in project-local configuration or documentation without committing credentials.
