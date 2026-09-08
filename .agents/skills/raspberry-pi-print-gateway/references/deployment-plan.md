# Saijai Print Gateway on Raspberry Pi

This is a planning reference, not permission to change a live network, print
physical paper, or deploy production. Confirm site-specific values before use.

## Decision summary

The current `print-bridge/` is a small dependency-free Node service, but the
repository declares Node `>=24` and `print-bridge/Dockerfile` starts from
`node:24-slim`. Raspberry Pi 2 Model B revision 1.1 is an ARMv7/32-bit-class
device with 1 GB RAM and wired 10/100 Ethernet. Raspberry Pi OS documents the
32-bit edition for Raspberry Pi 2 and the Lite edition for headless/older
devices.

The compatibility risk is not CPU load; it is the runtime distribution:

- Node.js 24 official release indexes checked on 2026-09-08 list Linux ARM64,
  but no Linux ARMv7 binary.
- Node.js 22 release indexes still list Linux ARMv7 binaries.
- Docker documents Raspberry Pi OS 32-bit/armhf support, with Engine v28 as the
  final major version planned to provide armhf packages.
- The current `node:24-slim` image and the repository's `>=24` engine contract
  therefore must not be assumed to work on Pi 2.

Recommended decision:

1. **Production recommendation:** use a newer ARM64 Pi or another supported
   always-on host and keep the current Node 24 gateway unchanged.
2. **Pi 2 POC/reuse path:** use Raspberry Pi OS Lite 32-bit, native systemd,
   and a separately tested Node 22 ARMv7 runtime. Treat changing the engine
   constraint/image as a compatibility change, not as a deployment-only detail.
3. **Docker on Pi 2:** use only after proving an ARMv7 image and Docker Engine
   v28-compatible setup. Avoid making Docker the first path on a 1 GB board.

## GitHub/repository decision

Do not split the gateway merely because it runs on another machine. Keeping it
under this repository preserves the browser/API contract, print behavior,
focused tests, and synchronized security changes.

A separate repository becomes reasonable when the gateway has its own release
cadence, deployment credentials, issue tracking, or operator access. The
gateway code is already a clean candidate because `print-bridge/` has its own
package metadata and no application dependency installation. If splitting,
copy the gateway source and tests only after defining a compatibility contract:

- API paths and response codes (`/health`, `/printers`, `/discover`, trust, and
  `/print/:id`);
- gateway version and app compatibility;
- environment variable names and state-file format;
- supported architectures and runtime versions;
- release artifact/image provenance and rollback procedure.

Suggested GitHub name: `saijai-print-gateway`.
Alternatives: `saijai-lan-print-gateway` or `saijai-phareab-print-gateway`.
The first name is preferred because it matches the existing package identity
and does not tie the service to Raspberry Pi hardware.

## Target topology

```text
https://saijaiphareab.shop
        ↓ browser
https://print.<shop-domain>:17321
        ↓ private LAN TCP
<reserved-printer-ip>:<confirmed-port>
```

The Pi and printer should be on a trusted, routable shop LAN. Prefer wired
Ethernet for the Pi. Prefer a DHCP reservation for the Pi and printer rather
than hard-coding a temporary address. The printer's current hotspot address
`172.20.10.2:9100` is a test value only and must not be used for final shop
configuration.

For the inspected XP-C260M unit, the project reference records Wi-Fi TCP
Server port `9100`, 72 mm printable width, and a confirmed unit-specific
firmware/profile. Re-check the unit after it joins the shop network, because
the address and interface identity change even when the printer does not.

## Native systemd plan for Pi 2

Use this as a runbook outline; fill in paths and addresses only after checking
the actual Pi.

1. Install Raspberry Pi OS Lite 32-bit, enable SSH during imaging, change the
   default credentials, and connect the Pi by Ethernet.
2. Update the OS, set a stable hostname, reserve its DHCP lease, and confirm
   `uname -m`, free memory, disk space, and clock synchronization.
3. Install a tested ARMv7 Node runtime. Do not use the repository's Node 24
   requirement unchanged unless an ARMv7 build has been independently proven.
4. Copy the standalone `print-bridge/` source and its tests to a versioned
   application directory. Keep `/etc/saijai-print-gateway/.env` owner-readable
   only and keep the state file on persistent storage.
5. Configure the gateway with the shop app origin, stable HTTPS public URL,
   certificate/key paths, a `/32` printer discovery CIDR, the confirmed port,
   bounded timeouts, and a state path.
6. Run the gateway under a dedicated unprivileged user with systemd restart
   policy and a health check. Restrict the listening port with the host
   firewall to the trusted shop network.
7. Verify health and discovery without printing. Trust the candidate only when
   the candidate corresponds to the intended physical unit.
8. Run the staged physical verification ladder and record the result outside
   source control.

Native systemd is preferred here because it avoids a second compatibility
surface (Docker Engine, Compose plugin, ARM image manifest, container volume
permissions) on an old 1 GB board.

## Docker plan if the POC requires it

Do not use the current `print-bridge/Dockerfile` unchanged on Pi 2. First prove:

- `docker version` is within the armhf support window;
- the selected image has `linux/arm/v7` support;
- the selected Node version satisfies the code after an explicit compatibility
  decision;
- the gateway starts with a read-only root filesystem, writable persistent
  state volume, non-root user, healthcheck, and no unnecessary capabilities;
- `docker compose config --quiet` and a clean `up` work on the Pi.

The existing Compose design is a useful security baseline: read-only container,
tmpfs for `/tmp`, dropped capabilities, `no-new-privileges`, and a named state
volume. Preserve those properties if adapting it. Do not pass app secrets into
the gateway container.

## Verification commands

Software-only checks on the Pi:

```bash
uname -m
cat /etc/os-release
node --version
node -p "process.arch + ' ' + process.platform"
free -h
df -h
timedatectl status
hostname -I
```

Network checks, using confirmed values only:

```bash
ping -c 3 <confirmed-printer-ip>
nc -vz <confirmed-printer-ip> <confirmed-port>
curl -fsS -H 'Origin: https://<app-origin>' \
  https://<gateway-hostname>:17321/health
```

The port check does not prove that the target is the intended printer. A real
print requires explicit authorization and should start with a minimal ASCII
fixture, followed by Thai raster, logo/QR, feed, and cut checks.

## Rollback and incident rules

- If a runtime compatibility test fails, revert the deployment artifact/runtime;
  do not weaken the gateway security boundary to make it start.
- If a print returns `UNKNOWN_PROGRESS`, inspect the printer before any retry.
- If the printer address changes, update only the gateway environment and
  recreate/restart the gateway; do not change application source or database
  records.
- Back up the gateway state mapping before replacement, but do not commit it.
- Firmware updates, factory reset, power changes, and network reconfiguration
  are separate physical authorities and require explicit direction.

## Evidence and authority

The user-provided `raspberry_pi_2_model_b_v1_1_usage_guide.md` is useful for
general board setup: 32-bit OS, Lite/headless mode, Ethernet, SSH, DHCP
reservation, and safe shutdown. It is not evidence that the current Node 24
image works on ARMv7 and it is not allowed to override project print semantics.

The project references and executable code define the Gateway contract. Official
platform references checked for this plan:

- https://www.raspberrypi.com/documentation/computers/os.html
- https://www.raspberrypi.com/documentation/computers/raspberry-pi.html
- https://docs.docker.com/engine/install/raspberry-pi-os/
- https://nodejs.org/download/release/v24.0.0/
- https://nodejs.org/download/release/v22.23.2/
