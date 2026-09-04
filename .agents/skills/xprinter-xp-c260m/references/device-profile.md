# XP-C260M Device Profile

Use this reference for hardware capability, consumables, electrical safety, and revision-sensitive decisions.

## Two layers of truth

1. **The unit label and self-test** describe the physical printer being configured.
2. **The model-family specification** describes available XP-C260M configurations and must not override the unit.

The unit used to prepare this profile is labeled `260 mm/s` with `USB + Ethernet + Wi-Fi`. Do not infer that every XP-C260M has that combination.

## Saijai unit self-test — 2026-09-04

The user supplied a self-test for the physical Saijai printer. Treat the values
in this section as confirmed for that unit only, not for every XP-C260M.

| Field | Confirmed value |
| --- | --- |
| Model | Xprinter XP-C260M |
| Firmware | `7.022PROY`, modified `2026-02-03` |
| Speed | 260 mm/s |
| Interfaces | USB printing, 10/100 Ethernet, Wi-Fi `802.11a/g/n` via WF-B30D (2.4/5 GHz) |
| Ethernet network | TCP/IP, static address `192.168.123.100/24`, gateway `192.168.123.1`, DHCP disabled |
| Ethernet MAC | `00-30-91-63-5C-18` |
| Wi-Fi transport | TCP Server with confirmed raw TCP port `9100` |
| Wi-Fi network | STA mode, connected to SSID `lxibel` with WPA2PSK/AES; DHCP address `172.20.10.2/28`, gateway `172.20.10.1` |
| Wi-Fi MAC | `78:1E:B8:7D:69:22` |
| Printable width | 72 mm; Font A 48 columns, Font B 64 columns |
| Default text settings | Font A, Page 0 / PC437 |
| Confirmed Thai code pages | Page 70 = PC874; Page 255 = Thai |
| Cutter and beeper | Reported available; self-test reports `Yes` for peel mode, cutter alarm, and idle alarm |
| 2D codes | QR Code, PDF417, Data Matrix |
| 1D codes | UPC-A/E, EAN/JAN-13/8, CODE39, CODABAR, ITF, CODE93, CODE128 |
| Other | NV image download and font customization supported; black mark disabled |
| Reliability settings | Avoid Lost Document off; printer queueing unavailable |
| Density | Level 5, maximum 8 |

The self-test confirms feature presence, not application-command compatibility.
Keep native QR, beeper, NV image, and custom-font commands disabled in
the application until each command is physically verified on this firmware.
The Saijai application now enables only the confirmed cutter capability and
places one partial-cut command after the complete document and tear-off feed;
the next physical receipt should confirm command compatibility.

The 72 mm width is consistent with a 576-dot target at the model-family 203 DPI
profile, but `576` remains a derived render setting until a width/alignment test
passes. The latest self-test confirms `TCP Server` on raw TCP port `9100` for
the current Wi-Fi interface.

The Wi-Fi radio is now a connected station/client, replacing the older AP-mode
self-test. Its current `172.20.10.2` address comes from a mobile hotspot and is
valid only for home/hotspot testing. It is not the final shop production
address. After installation at the shop, obtain the new DHCP address and create
a reservation for Wi-Fi MAC `78:1E:B8:7D:69:22` before changing production
discovery. Never record the router password in this repository.

The physical Page 70 / CP874 test on firmware `7.022PROY` produced Chinese or
incorrect glyphs even though ASCII was correct. The application therefore uses
Prompt-font raster blocks for every text operation containing Thai. Page 70
(`ESC t 0x46`) and Page 255 (`ESC t 0xFF`) remain explicit diagnostic options
only and are not production defaults.

Keep the two interface identities separate: Ethernet uses MAC
`00-30-91-63-5C-18` and static address `192.168.123.100`; Wi-Fi uses MAC
`78:1E:B8:7D:69:22` and currently has the temporary hotspot address above.
Neither address is the Print Gateway host address.

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
