# Saijai XP-C260M Setup

Use this reference for first installation, `.env`, Docker, LAN addressing, HTTPS, and browser setup.

## Known and unresolved site values

Keep confirmed facts separate from assumptions:

| Value | Status on 2026-09-04 |
| --- | --- |
| Public application origin | Confirmed: `https://saijaiphareab.shop` |
| Intended Gateway origin | Proposed example: `https://print.saijaiphareab.shop:17321`; DNS, reachability, and trusted TLS are not yet evidenced |
| Physical printer | Confirmed from user-supplied self-test: Xprinter XP-C260M, firmware `7.022PROY`, USB + 10/100 Ethernet + Wi-Fi |
| Ethernet interface | Static `192.168.123.100/24`, gateway `192.168.123.1`, DHCP disabled, MAC `00-30-91-63-5C-18`; this is not the current Wi-Fi endpoint |
| Current Wi-Fi test state | Confirmed connected: STA mode, SSID `lxibel`, WPA2PSK/AES, DHCP enabled, MAC `78:1E:B8:7D:69:22` |
| Current home/hotspot endpoint | Confirmed from latest self-test: `172.20.10.2:9100` (`/28`, gateway `172.20.10.1`); valid only while attached to that hotspot |
| Final shop production printer IP | Unresolved until the printer joins the shop network; replace the test CIDR after installation and prefer a DHCP reservation for the Wi-Fi MAC |
| Raw TCP protocol/port | Confirmed for the current Wi-Fi interface: TCP Server on `9100` |
| Printable width | Confirmed: 72 mm and 48 Font-A columns; 576 dots is the expected render target but still requires a physical width test |
| Gateway host LAN address | Unconfirmed; it is a computer/server running `print-bridge`, not the printer address |
| Optional features | Self-test confirms cutter hardware; the application emits one trailing partial cut after four feed lines. Beeper, native QR/PDF417/Data Matrix, NV image, and font customization remain disabled until separately verified |

Do not store the router password from a self-test or configuration page. The
SSID and authentication mode above describe the confirmed connection state;
they are not credentials.

Update this table only from observed evidence. Do not silently promote an example or candidate to a confirmed fact.

## Identify the physical printer

Before configuring the Gateway, collect:

- exact model and hardware/firmware revision;
- interfaces present on this unit;
- paper width and active printable dots;
- DHCP/static mode, IP address, subnet mask, gateway, MAC address;
- raw-print protocol and TCP port;
- status of cutter and any optional features that the product actually needs.

Prefer the unit's self-test or network configuration page. The button sequence can vary by revision, so follow the label/manual for the unit. A common thermal-printer sequence is power off, hold `FEED`, power on, then release when printing begins; treat that only as a candidate procedure until confirmed for this unit.

If the page does not show an address, inspect the shop router's DHCP/connected-client list and match the printer MAC or vendor name. Basic verification from a shop host is:

```bash
ping -c 3 <CONFIRMED_PRINTER_IP>
nc -vz <CONFIRMED_PRINTER_IP> <CONFIRMED_PORT>
```

`ping` may be blocked even when printing works. A successful `nc` check proves only that something accepts the TCP port, not that it is the intended printer. Do not send bytes until the target and physical side effect are explicitly authorized.

Create a DHCP reservation for the confirmed printer MAC so the address remains stable. Prefer a `/32` discovery scope for a known single printer; use a wider private subnet only when replacement discovery requires it and the user authorizes scanning that scope.

## Choose the deployment topology

The browser that presses print must reach the Gateway, and the Gateway must reach the printer on the shop LAN.

The latest self-test supersedes the former AP-mode state: Wi-Fi is now in STA
mode and reports the router as connected. For a home/hotspot test, a Gateway
host attached to the same hotspot may target `172.20.10.2:9100`. This does not
prove that hotspot client isolation, host routing, or the TCP endpoint is
reachable; verify those separately without broad scanning.

Do not deploy `172.20.10.2/32` as the final shop CIDR. When the printer joins
the shop Wi-Fi, record its new address, reserve that address for Wi-Fi MAC
`78:1E:B8:7D:69:22`, and update only the Gateway host environment. Keep the
Ethernet address, Wi-Fi address, and Gateway host address as separate values.

Recommended topology:

```text
Shop browser
  -> https://saijaiphareab.shop
  -> https://print.saijaiphareab.shop:17321  (Gateway host in shop)
  -> private printer IP + confirmed port
```

The public app may run in the cloud, but raw printer bytes travel from the shop browser to the shop Gateway. The cloud server does not open a socket to the private printer. Use local/split DNS or another controlled route so the Gateway hostname resolves to the Gateway host from shop devices. Every browser must trust the Gateway certificate; a self-signed certificate that produces a browser warning is not production-ready.

Do not expose the printer raw port to the internet. Do not expose the Gateway without exact origin controls and trusted HTTPS. The Gateway also requires a private/loopback client source and assumes the shop LAN is trusted; use firewall/VLAN isolation and do not deploy it on an untrusted LAN.

## Environment ownership

`.env.example` is the maintained template. Real secrets stay in an uncommitted `.env` with owner-only permissions:

```bash
chmod 600 .env
```

If the Nuxt app and Gateway run on different hosts, each host has its own `.env` containing only the relevant values. The Gateway Compose service receives only `PRINT_GATEWAY_*`; it does not need database, Better Auth, LINE, Cloudinary, or payment secrets.

### Nuxt app values

```dotenv
NUXT_PUBLIC_PRINT_GATEWAY_ENABLED=true
NUXT_PUBLIC_PRINT_GATEWAY_URL=https://print.saijaiphareab.shop:17321
NUXT_PUBLIC_PRINT_LEGACY_DIRECT=true
```

These are browser-visible configuration, not secrets. Keep Gateway disabled until its HTTPS endpoint works from actual shop browsers.

The Nuxt server also needs `PAYMENT_QR_RECEIVER_KEYS` before an administrator
can save a PromptPay mobile number. It is a JSON object mapping an integer key
version to a base64-encoded 32-byte AES key. Generate a key locally with
`openssl rand -base64 32`, place it only in the app host's secret environment,
and then configure the mobile number at `/admin/settings/shop`. Never put the
receiver number or this key in a `NUXT_PUBLIC_*` variable or in the Gateway
environment.

### Gateway host values

```dotenv
PRINT_GATEWAY_BIND_HOST=0.0.0.0
# Prefer the Gateway host's shop-LAN interface IP when it is stable; use
# 0.0.0.0 only when the host firewall intentionally limits access.
PRINT_GATEWAY_PUBLISH_HOST=0.0.0.0
PRINT_GATEWAY_PORT=17321
PRINT_GATEWAY_PUBLIC_URL=https://print.saijaiphareab.shop:17321
PRINT_GATEWAY_ALLOWED_ORIGINS=https://saijaiphareab.shop
PRINT_GATEWAY_DISCOVERY_CIDRS=<CONFIRMED_PRINTER_IP>/32
PRINT_GATEWAY_DISCOVERY_PORTS=9100
PRINT_GATEWAY_DISCOVERY_TIMEOUT_MS=500
PRINT_GATEWAY_DISCOVERY_CONCURRENCY=16
PRINT_GATEWAY_RESCAN_TTL_MS=30000
PRINT_GATEWAY_MAX_PAYLOAD_BYTES=2000000
PRINT_GATEWAY_TCP_TIMEOUT_MS=10000
PRINT_GATEWAY_TLS_CERT_HOST_PATH=/absolute/host/path/print.saijaiphareab.shop.crt
PRINT_GATEWAY_TLS_KEY_HOST_PATH=/absolute/host/path/print.saijaiphareab.shop.key
```

The production printer address remains a placeholder until installation at the
shop; raw TCP port `9100` is confirmed by the latest physical self-test. The
Gateway uses no pairing secret or browser bearer token.

For native Node rather than Docker, set `PRINT_GATEWAY_STATE_PATH` to a protected local path and use `PRINT_GATEWAY_TLS_CERT_PATH`/`PRINT_GATEWAY_TLS_KEY_PATH`. Docker sets the in-container state and TLS paths itself.

## Local fake-printer profile

The committed local defaults are deliberately harmless: loopback Gateway, fake discovery target `127.0.0.1:19100`, and no LAN scan. Validate configuration and start the stack with:

```bash
docker compose -f docker-compose.local.yml config --quiet
docker compose -f docker-compose.print-gateway.yml config --quiet
docker compose -f docker-compose.local.yml up --build -d
docker compose -f docker-compose.print-gateway.yml up --build -d
```

Check:

```bash
docker compose -f docker-compose.local.yml ps
docker compose -f docker-compose.print-gateway.yml ps
curl -fsS -H 'Origin: http://localhost:3004' http://127.0.0.1:17321/health
```

The local app is normally `http://localhost:3004`. Do not mistake a passing fake/loopback test for proof that the physical printer, Thai output, cutter, or LAN works.

## Home/hotspot physical-printer profile

Use this narrow target only while the printer and Gateway host are connected to
the currently confirmed hotspot. It configures discovery but does not authorize
a connection probe or test print:

```dotenv
PRINT_GATEWAY_DISCOVERY_CIDRS=172.20.10.2/32
PRINT_GATEWAY_DISCOVERY_PORTS=9100
```

Replace the CIDR after any hotspot reconnect or when moving the printer to the
shop network. Do not expand it to the entire hotspot subnet merely because the
DHCP address changed.

## Production Gateway startup

After DNS, trusted TLS, Gateway host address, and the final shop printer address
are confirmed:

```bash
docker compose \
  -f docker-compose.print-gateway.yml \
  -f docker-compose.print-gateway.production.yml \
  config --quiet

docker compose \
  -f docker-compose.print-gateway.yml \
  -f docker-compose.print-gateway.production.yml \
  up --build -d
```

Then verify service state and HTTPS health from a shop device. Do not print yet:

```bash
docker compose -f docker-compose.print-gateway.yml ps
curl -fsS -H 'Origin: https://saijaiphareab.shop' \
  https://print.saijaiphareab.shop:17321/health
```

## First browser setup

1. Open the production app from a shop browser.
2. Open a receipt or quotation and choose printer connection.
3. Select **Wi-Fi / Ethernet**.
4. No code is requested; the Gateway accepts the trusted shop LAN.
5. Choose **ค้นหาเครื่องพิมพ์ในร้าน**.
6. Confirm the discovered candidate with a human-readable name such as `เครื่องหน้าเคาน์เตอร์`.
7. Select paper width. Use 80 mm only after the physical unit confirms that profile.
8. With explicit permission, run the physical verification ladder in [saijai-operations.md](saijai-operations.md).

When exactly one trusted printer is online, subsequent connections select it automatically. Multiple online printers require an explicit UI selection.

## Data and reset boundaries

Docker persists trusted printer mappings in `saijai-print-gateway-state`. It contains no receipt queue, browser tokens, or database credentials.

Stopping or recreating the container preserves this volume. Deleting it removes trusted printers:

```bash
docker compose -f docker-compose.print-gateway.yml down --remove-orphans
# Destructive and only when an intentional Gateway reset is authorized:
docker volume rm saijai-print-gateway-state
```

Do not use `docker system prune --volumes` on a shared development machine.
