---
name: xprinter-xp-c260m
description: Configure, integrate, operate, or troubleshoot an Xprinter XP-C260M thermal receipt or kitchen printer over USB, Ethernet, or Wi-Fi, including the Saijai Phareab LAN Print Gateway, ESC/POS, Thai output, QR codes, cutters, and POS printing. Verify the actual unit before relying on model-family specifications.
---

# Xprinter XP-C260M

Support the XP-C260M without assuming every unit has the same interfaces, firmware, speed, power label, code pages, or network defaults.

## Saijai Phareab project

When working in this repository, read [references/saijai-architecture.md](references/saijai-architecture.md) first. It records the implemented print path, trust boundary, Hybrid rendering, immediate-send semantics, and source files that define current behavior.

- For installation, `.env`, Docker, LAN addressing, HTTPS, or first-time setup, also read [references/saijai-setup.md](references/saijai-setup.md).
- For normal use, printer replacement, safe verification, or incident handling, also read [references/saijai-operations.md](references/saijai-operations.md).
- Treat values marked **unconfirmed** in those references as discovery work, not configuration facts. Re-check the implementation and `.env.example` before changing configuration because the working tree may contain newer work.
- The project references refine the generic guidance below. In particular, Saijai deliberately uses an immediate one-attempt print flow with a per-printer mutex, not a durable print-job queue.
- For receipt/quotation content or cutter changes, compare the canonical web
  document with the server-owned `PrintDocument`; do not infer missing fields.
  The inspected XP-C260M cutter is enabled only as one trailing partial-cut
  command after the complete document and tear-off feed.

## Establish the actual unit

Before recommending settings or changing code, determine what matters for the request:

- the interfaces printed on the unit label;
- the self-test or configuration-page values, when available;
- connection in use: USB, Ethernet, or Wi-Fi;
- operating system, runtime, POS architecture, and printing library;
- paper width and the behavior being tested;
- whether the request is setup, integration, output formatting, or diagnosis.

Read [references/device-profile.md](references/device-profile.md) when specifications, compatibility, power, paper, or hardware capabilities affect the answer. Treat its inspected-unit configuration separately from model-family facts.

## Choose the relevant path

- For application architecture, ESC/POS data, network printing, Thai text, images, QR codes, job queues, or cash drawers, read [references/integration.md](references/integration.md).
- For connection failures, blank or garbled output, Thai rendering, cutting, duplicate jobs, poor print quality, or firmware concerns, read [references/troubleshooting.md](references/troubleshooting.md).

Use both references when diagnosing an integration end to end.

## Operating boundaries

- Prefer Ethernet for a shared, always-on POS or kitchen printer when the site can provide stable LAN addressing. Wi-Fi and USB remain valid when they fit the deployment better.
- Do not assume RAW TCP port `9100`; confirm the port and protocol from the self-test, configuration utility, or verified manual for the unit.
- A browser application cannot normally open a raw printer socket directly. Route printing through a trusted backend, local print service, desktop shell, or OS print path.
- Test the unit's Thai code page before using text mode. Use raster output when firmware shaping or code-page behavior cannot render Thai reliably.
- Serialize jobs per printer. A successful socket write is not proof that paper was printed, cut, or collected.
- Do not expose a printer or raw print port to the public internet. Restrict destinations and credentials when a server accepts print requests.

## Safety and authority

- Sending a test page, cutting paper, opening a cash drawer, changing network settings, resetting the device, or updating firmware affects physical equipment. Do it only within the user's request and against an explicitly identified target.
- For power replacement, match `24V DC` only after confirming the unit label, connector, polarity, and required current. Prefer an adapter approved for that exact unit or revision.
- The protective cover and water-resistant design do not establish an IP rating. Keep the printer away from direct spray, washing, condensation, excessive heat, and grease buildup.
- Use firmware for the exact hardware revision. Do not update firmware as a speculative troubleshooting step.

## Verification ladder

Use the narrowest checks needed and stop when the requested outcome is verified:

1. Confirm the printer's own self-test and configuration.
2. Confirm the selected transport without changing unrelated settings.
3. Print a minimal ASCII receipt.
4. Test the required real content: Thai, logo, QR or barcode, feed, and cut as applicable.
5. Test representative width, long content, concurrent jobs, reconnects, and error recovery when the production workflow requires them.

Record the exact interface, address or queue name, port or driver path, paper width, render mode, and successful test. Redact Wi-Fi credentials, device identifiers, internal network details, and customer receipt data from reports.
