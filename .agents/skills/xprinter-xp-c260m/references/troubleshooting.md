# XP-C260M Troubleshooting

Use this reference to diagnose the printer itself, its transport, or the application path. Change one layer at a time and preserve the last known-good configuration.

## Build a minimal signal

Start with the printer's documented self-test or configuration page. Do not guess the button sequence when the manual or unit labeling is available. Record the model/revision, active interfaces, address, port or protocol, firmware, printable width, and code-page information it exposes.

Then isolate the layers:

```text
Printer mechanism -> interface/link -> OS or socket -> ESC/POS bytes -> rendered content -> application queue
```

A minimal ASCII receipt with feed and no cutter is a useful first application signal. Add Thai, images, QR, and cutting one capability at a time.

## No power or no self-test

- Stop if the adapter voltage, polarity, connector, or unit label does not match.
- Check the approved adapter, outlet, cable seating, cover, paper, and visible indicators.
- Do not substitute an adapter based only on connector fit.
- If the printer cannot produce its own self-test, application debugging is premature.

## Ethernet or Wi-Fi not reachable

- Read the address and network mode from the current configuration page.
- Confirm the POS host and printer are on a routable network and that client isolation, VLANs, firewalls, or Wi-Fi isolation do not block them.
- Confirm link indicators and basic reachability before testing a print port.
- Verify the configured print protocol and port; do not assume `9100`.
- Avoid factory reset until the current network configuration is captured and the user intends to reconfigure the unit.

## Connection succeeds but nothing prints

- Confirm that the target is the intended printer, not merely a host accepting the port.
- Send a minimal known-good ESC/POS job through the same transport.
- Check cover, paper, error indicators, buffer state, and offline status.
- Compare bytes and library configuration with a known-good job.
- Add feed before testing cut so content is not left inside the mechanism.

## Garbled text or Thai marks are wrong

- Separate transport corruption from encoding by printing plain ASCII first.
- Confirm the library's byte encoding and selected printer code page.
- Test Thai combining marks, mixed Thai/Latin text, and wrapping physically.
- If the unit cannot render the required Thai reliably in text mode, switch the affected content to raster rendering.
- Confirm raster width and byte ordering when output is clipped, wrapped, or scrambled.

## Blank, faint, clipped, or dirty output

- Confirm thermal paper orientation and use suitable 80 mm thermal media.
- Check active printable width before rasterization.
- Reduce excessive density or heat settings and test a small monochrome fixture.
- Follow manufacturer guidance for cleaning the head and roller; power down and let the mechanism cool first.
- Do not use sharp tools, unapproved solvents, or direct water spray.

## Cutter or paper-feed problems

- Test feed independently from cut.
- Verify the library's command and whether the firmware expects partial cut.
- Ensure enough paper is fed beyond the print line before cutting.
- Remove jams using the documented mechanism after powering down when required.
- Repeated mechanical failures require service; do not keep firing the cutter as a diagnostic loop.

## Duplicate, missing, or interleaved receipts

- Ensure one serialized queue owns each printer connection.
- Log application job IDs and transport outcomes.
- Check whether retries occur after an ambiguous timeout or process restart.
- Do not treat socket success as physical-print confirmation.
- Define a deliberate duplicate policy for kitchen orders and receipts before enabling automatic retries.

## Black-mark or special-media problems

- Confirm that the installed media matches the unit's supported sensing position and configuration.
- Test ordinary continuous thermal paper first to isolate printing from mark detection.
- Change black-mark settings only with the correct manual or configuration utility for the hardware revision.

## Firmware and reset boundary

Firmware update and factory reset are last-stage maintenance operations, not ordinary debugging steps. Before either one:

- identify the exact hardware revision and installed firmware;
- obtain the matching firmware or procedure from Xprinter or an authorized source;
- capture network and application settings;
- confirm stable power;
- obtain explicit user authorization for the operation and downtime.

If evidence does not identify a software, transport, configuration, or consumable cause, report the remaining hardware suspicion and the checks already performed instead of repeatedly stressing the printer.
