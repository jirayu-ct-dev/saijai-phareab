# XP-C260M Device Profile

Use this reference for hardware capability, consumables, electrical safety, and revision-sensitive decisions.

## Two layers of truth

1. **The unit label and self-test** describe the physical printer being configured.
2. **The model-family specification** describes available XP-C260M configurations and must not override the unit.

The unit used to prepare this profile is labeled `260 mm/s` with `USB + Ethernet + Wi-Fi`. Do not infer that every XP-C260M has that combination.

## Core profile

| Capability | XP-C260M family / inspected unit |
| --- | --- |
| Printing | Direct thermal, ESC/POS compatible |
| Resolution | 203 DPI, approximately 8 dots/mm |
| Paper | 80 mm nominal; 79.5 ± 0.5 mm specified |
| Printable width | 72 mm |
| Dots per line | 576 or 512 depending on firmware/configuration |
| Speed | 230 or 260 mm/s depending on configuration; inspected unit says 260 mm/s |
| Roll diameter | Approximately 80 mm maximum |
| Paper thickness | 0.06–0.08 mm |
| Interfaces | USB and Ethernet configurations; serial, Bluetooth, or Wi-Fi vary by option/revision |
| Cutter | Automatic partial cut; approximately 1.5 million cuts specified |
| Print-head life | Approximately 150 km specified |
| Codes | Common 1D formats, QR Code, and PDF417 |
| Other functions | Black-mark detection, NV logo storage, sound/light alarm, IAP firmware upgrade |
| Input buffer / NV flash | 256 KB each in the referenced product information |
| Size / weight | 188 × 140 × 137.7 mm; approximately 1.1 kg |

At 8 dots/mm, a 72 mm printable area corresponds to 576 dots. Confirm the active width before rasterizing because some firmware/configurations report 512 dots per line.

## Electrical profile

The official product information lists a `24V DC / 2.5A` adapter output and `24V DC / 1A` cash-drawer output. The inspected unit label states a printer input of `24V DC / 2.0A`.

Treat these as revision-sensitive values:

- trust the unit label for the printer input;
- verify connector dimensions and polarity;
- use sufficient current capacity without changing voltage;
- use a manufacturer- or distributor-approved replacement;
- verify cash-drawer voltage and pinout before connecting it.

Do not infer electrical compatibility from the barrel connector fitting physically.

## Environment and media

| Condition | Specified range |
| --- | --- |
| Operating temperature | 0–45°C |
| Operating humidity | 10–80% RH |
| Storage temperature | -10–60°C |
| Storage humidity | 10–90% RH, without condensation |

Use good-quality thermal paper and keep dust, oil, adhesive, and moisture away from the print head and cutter. The product describes a protective/water-resistant cover design but does not state an IP rating.

## Character and language considerations

The product information lists Font A and Font B column counts that vary by configuration and includes a GB18030 Simplified Chinese font library. It does not establish reliable Thai shaping for every firmware.

For Thai output:

1. Print a code-page test with the actual firmware and library.
2. Verify vowels, tone marks, mixed Thai/Latin text, numbers, and line wrapping.
3. If text mode is unreliable, render the receipt to a 1-bit raster image at the confirmed printable width.

Raster output is more predictable but produces larger jobs and may print more slowly.

## Configuration record

Capture only what the task needs and redact sensitive values when sharing:

```yaml
model: XP-C260M
hardware_revision: <from label or self-test>
interfaces: [<USB|Ethernet|Wi-Fi|Serial|Bluetooth>]
print_speed: <from label or self-test>
printable_dots: <576|512|verified-other>
paper_width_mm: <verified>
connection:
  type: <USB|Ethernet|Wi-Fi>
  address_or_queue: <redacted when shared>
  port_or_driver: <verified value>
firmware: <verified value>
code_page: <verified value>
render_mode: <text|raster|mixed>
power_label: <voltage/current from this unit>
```

## Sources

- [Official XP-C260M product page](https://www.xprinter.net/product/522.html)
- [Official Xprinter website and downloads](https://www.xprinter.net/)

This profile was reconciled against the official product page and the supplied inspected-unit specification on 2026-09-01. Re-check official documentation and the physical unit when a revision-sensitive value affects safety or compatibility.
