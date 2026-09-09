# Pi 2 Native POC Runbook

This records the verified Raspberry Pi 2 Model B v1.1 proof-of-concept path
used for this repository. It is an operational memory aid, not evidence that
the Pi 2 is suitable for production. The observed deployment used Raspbian
GNU/Linux 13 (trixie), `armv7l`, Node 22.23.2 ARMv7, USB tether networking,
and native systemd. Do not silently turn the temporary local-only values below
into a production LAN configuration.

## Verified facts

- The board reported `uname -m` as `armv7l`.
- The board reported Raspbian GNU/Linux 13 (trixie).
- The board had about 920 MiB RAM visible to the OS.
- The network route was through `usb0`; the observed address was
  `10.247.138.208` with gateway `10.247.138.37`.
- Node 24 was not the Pi 2 runtime path. Node 22.23.2's official Linux ARMv7
  archive was used instead, installed so `command -v node` returned
  `/usr/local/bin/node`.
- `print-bridge/package.json` has no `scripts.test`, no runtime dependencies,
  and no `npm install` step is needed for this standalone service.
- `node bin/bridge.mjs --version` returned `0.3.0`; `--help` also worked.
- The service was installed under `/opt/saijai-print-gateway`.
- The final systemd unit created during the POC was named
  `saijai-gateway.service`. A future deployment should choose one service name
  and use it consistently; a name mismatch makes `systemctl enable` report that
  the unit does not exist.

## USB transfer path

On the Mac, the USB volume was `/Volumes/FD-PAN` and contained the standalone
`print-bridge/` directory. On the Pi, the USB partition was `/dev/sda1`.
Mount the partition, not a file underneath it:

```bash
sudo mkdir -p /tmp/printusb
sudo mount /dev/sda1 /tmp/printusb
```

If creating a mountpoint under `/mnt` returns `Input/output error`, do not
format the disk or run repair commands blindly. Try a mountpoint under `/tmp`
and inspect `lsblk -f`, `findmnt /`, `df -hT /`, and `sudo dmesg -T | tail -40`.

Copy the service source to persistent storage:

```bash
sudo mkdir -p /opt/saijai-print-gateway
sudo cp -a /tmp/printusb/print-bridge/. /opt/saijai-print-gateway/
sudo chown -R pi:pi /opt/saijai-print-gateway
```

The USB can be unmounted only after all required files have been copied:

```bash
mountpoint -q /tmp/printusb && sudo umount /tmp/printusb
```

## Local-only environment used for the first boot

The initial env file was copied to `/etc/saijai-print-gateway.env` and was
owner-readable only. It deliberately bound to loopback and used the disposable
fake-printer port; it did not expose the Gateway to the Mac or configure the
real Xprinter:

```dotenv
PRINT_GATEWAY_ENV_FILE=/etc/saijai-print-gateway.env
PRINT_GATEWAY_BIND_HOST=127.0.0.1
PRINT_GATEWAY_PORT=17321
PRINT_GATEWAY_PUBLIC_URL=http://127.0.0.1:17321
PRINT_GATEWAY_ALLOWED_ORIGINS=http://localhost:3004
PRINT_GATEWAY_DISCOVERY_CIDRS=127.0.0.1/32
PRINT_GATEWAY_DISCOVERY_PORTS=19100
PRINT_GATEWAY_DISCOVERY_TIMEOUT_MS=500
PRINT_GATEWAY_DISCOVERY_CONCURRENCY=16
PRINT_GATEWAY_RESCAN_TTL_MS=30000
PRINT_GATEWAY_MAX_PAYLOAD_BYTES=2000000
PRINT_GATEWAY_TCP_TIMEOUT_MS=10000
PRINT_GATEWAY_STATE_PATH=/var/lib/saijai-print-gateway/gateway-state.json
PRINT_GATEWAY_DEBUG_BYTES=false
```

For a service running as `User=pi`, the env file must be readable by `pi`:

```bash
sudo chown pi:pi /etc/saijai-print-gateway.env
sudo chmod 600 /etc/saijai-print-gateway.env
sudo mkdir -p /var/lib/saijai-print-gateway
sudo chown -R pi:pi /var/lib/saijai-print-gateway
```

The confusing `node: /etc/saijai-print-gateway.env: not found` message was
caused by the `pi` process not being able to read a `root:root` mode-600 env
file, not by the file being absent. Check ownership and mode before changing
the path.

## Native systemd unit

The effective unit uses the installed Node path and loads the env file as an
EnvironmentFile. `EnvironmentFile` must point to the `.env` file; it must not
point to `bin/bridge.mjs`:

```ini
[Unit]
Description=Saijai LAN Print Gateway
After=network-online.target
Wants=network-online.target

[Service]
User=pi
WorkingDirectory=/opt/saijai-print-gateway
EnvironmentFile=/etc/saijai-print-gateway.env
ExecStart=/usr/local/bin/node /opt/saijai-print-gateway/bin/bridge.mjs
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Save it as the exact unit name selected for the deployment, then use that same
name in every command. For the POC's actual name:

```bash
sudo chown root:root /etc/systemd/system/saijai-gateway.service
sudo chmod 644 /etc/systemd/system/saijai-gateway.service
sudo systemctl daemon-reload
sudo systemctl enable --now saijai-gateway.service
sudo systemctl status --no-pager saijai-gateway.service
```

The observable POC completion condition was `active (running)`. This proves
the process is supervised and enabled; it does not prove that the Mac can
reach it or that the real printer can be discovered.

## Address and port changes after the POC

Keep the three address groups separate:

| Changed thing | Owner | Values |
| --- | --- | --- |
| Printer IP/port | Gateway env | `PRINT_GATEWAY_DISCOVERY_CIDRS`, `PRINT_GATEWAY_DISCOVERY_PORTS` |
| Gateway IP/hostname/port | Gateway env, DNS/TLS, app env | `PRINT_GATEWAY_PUBLIC_URL`, `PRINT_GATEWAY_PORT`, `NUXT_PUBLIC_PRINT_GATEWAY_URL` |
| Browser app origin | Gateway env | `PRINT_GATEWAY_ALLOWED_ORIGINS` |

### Printer IP or printer TCP port

1. Confirm the new printer IP, interface MAC, and raw TCP port from the
   printer self-test, network page, or DHCP list. Do not assume `9100`.
2. Edit `/etc/saijai-print-gateway.env` on the Pi:

   ```dotenv
   PRINT_GATEWAY_DISCOVERY_CIDRS=<confirmed-printer-ip>/32
   PRINT_GATEWAY_DISCOVERY_PORTS=<confirmed-printer-port>
   ```

3. Verify the route from the Pi with `ping` and `nc`, then restart:

   ```bash
   sudo systemctl restart saijai-gateway.service
   sudo systemctl status --no-pager saijai-gateway.service
   ```

4. In the browser, run printer discovery and trust the new candidate. If it is
   the same physical printer, replace the old mapping. Keep the state file and
   do not edit or delete `gateway-state.json` just because the address changed.

Changing only the printer address does not require changing the app's Gateway
URL, Gateway public URL, DNS, TLS certificate, source code, or database.

### Gateway IP, hostname, or Gateway port

If only the Pi's IP changes and the stable Gateway hostname/DNS remains valid,
keep the app URL and verify the certificate. If the hostname or direct IP in
the app URL changes, update the app host `.env`:

```dotenv
NUXT_PUBLIC_PRINT_GATEWAY_ENABLED=true
NUXT_PUBLIC_PRINT_GATEWAY_URL=https://<gateway-hostname-or-ip>:17321
```

If the Gateway port changes, update both sides to the same port:

```dotenv
# Gateway host
PRINT_GATEWAY_PORT=17421
PRINT_GATEWAY_PUBLIC_URL=https://<gateway-hostname>:17421

# App host
NUXT_PUBLIC_PRINT_GATEWAY_URL=https://<gateway-hostname>:17421
```

Also update firewall/reverse-proxy/DNS/TLS as applicable, restart the systemd
unit, and rebuild/redeploy the app because `NUXT_PUBLIC_*` values are build
inputs. Keep `PRINT_GATEWAY_ALLOWED_ORIGINS` unchanged unless the app origin
also changes.

### Promotion to the product web

The production app and Gateway must use a trusted HTTPS origin and a private,
routable printer address:

```dotenv
# App host
NUXT_PUBLIC_PRINT_GATEWAY_ENABLED=true
NUXT_PUBLIC_PRINT_GATEWAY_URL=https://<gateway-hostname>:17321

# Gateway host
PRINT_GATEWAY_BIND_HOST=0.0.0.0
PRINT_GATEWAY_PORT=17321
PRINT_GATEWAY_PUBLIC_URL=https://<gateway-hostname>:17321
PRINT_GATEWAY_ALLOWED_ORIGINS=https://saijaiphareab.shop
PRINT_GATEWAY_DISCOVERY_CIDRS=<confirmed-printer-ip>/32
PRINT_GATEWAY_DISCOVERY_PORTS=<confirmed-printer-port>
PRINT_GATEWAY_TLS_CERT_PATH=/absolute/path/to/fullchain.pem
PRINT_GATEWAY_TLS_KEY_PATH=/absolute/path/to/privkey.pem
```

Do not expose the Gateway or printer TCP port to the public internet. Verify
health, discovery, and trust before authorizing a physical test print.

## Post-reboot verification

Before rebooting, the service should already be enabled. After the Pi comes
back and you log in, run:

```bash
systemctl is-enabled saijai-gateway.service
systemctl is-active saijai-gateway.service
```

Expected output is `enabled` and `active`. Check the local-only POC health with
the Origin that is present in the env file:

```bash
curl -fsS -H 'Origin: http://localhost:3004' \
  http://127.0.0.1:17321/health
```

For a production HTTPS Gateway, use the exact production app origin and
hostname instead:

```bash
curl -fsS -H 'Origin: https://saijaiphareab.shop' \
  https://<gateway-hostname>:17321/health
```

## Verified shop production values

The shop deployment observed on 2026-09-09 promoted the native service to the
following private-LAN topology:

```text
App origin:       https://saijaiphareab.shop
Gateway origin:   https://print.saijaiphareab.shop:17321
Gateway address:  192.168.1.175
Printer endpoint: 192.168.1.171:9100
```

The router had DHCP reservations for both devices. Cloudflare had a DNS-only A
record mapping `print.saijaiphareab.shop` to the private Gateway address. The
Gateway health endpoint returned version `0.3.0`, TCP reachability to the
printer succeeded, and discovery returned a candidate. These checks did not by
themselves prove a completed physical print.

The runtime TLS paths were:

```dotenv
PRINT_GATEWAY_TLS_CERT_PATH=/etc/saijai-print-gateway/tls/fullchain.pem
PRINT_GATEWAY_TLS_KEY_PATH=/etc/saijai-print-gateway/tls/privkey.pem
```

Certificate renewal uses Certbot's Cloudflare DNS plugin. The API token is kept
in `/root/.secrets/certbot/cloudflare.ini` with mode `600`; never display or
commit it. The intended deploy hook at
`/etc/letsencrypt/renewal-hooks/deploy/saijai-gateway.sh` is configured to copy
the renewed certificate and key to the runtime paths and restart
`saijai-gateway.service`.

The following non-printing verification succeeded on 2026-09-09:

```bash
sudo certbot renew --dry-run
systemctl is-active certbot.timer
systemctl is-active saijai-gateway.service
```

Expected results are a successful simulated renewal followed by `active` and
`active`. A Cloudflare Python `PendingDeprecationWarning` is not a renewal
failure; do not change system Python packages merely to suppress it. The dry-run
proved the DNS renewal path, not execution of the deploy hook; after the first
real renewal, verify the runtime certificate, service state, and `/health`.

If the service is not active, inspect only the current boot first:

```bash
sudo journalctl -u saijai-gateway.service -b -n 50 --no-pager
```

To discover the Pi values used when deciding a Gateway hostname:

```bash
hostnamectl --static
hostname -I
ip -4 -br addr
ip route
```

`hostname` is only a local name until the shop DNS, router DNS, or mDNS makes
it resolvable from the browser device. An IP such as the temporary USB-tether
address may change after reboot and should not be treated as a production
Gateway hostname without a reservation and matching trusted TLS certificate.

To review non-secret Gateway settings without printing the whole env file:

```bash
sudo grep -E '^(PRINT_GATEWAY_BIND_HOST|PRINT_GATEWAY_PORT|PRINT_GATEWAY_PUBLIC_URL|PRINT_GATEWAY_ALLOWED_ORIGINS|PRINT_GATEWAY_DISCOVERY_CIDRS|PRINT_GATEWAY_DISCOVERY_PORTS)=' /etc/saijai-print-gateway.env
```

## What remains before real printing

- Replace loopback-only values with a confirmed shop topology and stable HTTPS
  origin before allowing browser access from another device.
- Confirm the Pi and printer are on the same routable private network.
- Confirm the XP-C260M's current IP and TCP port from its actual network
  configuration; do not reuse a temporary hotspot address or assume port 9100.
- Set a `/32` discovery CIDR for the confirmed printer and the exact app origin.
- Verify `/health` and discovery first. A physical print is an external side
  effect and must be explicitly authorized.
- Keep the gateway's no-automatic-retry and `UNKNOWN_PROGRESS` semantics.
