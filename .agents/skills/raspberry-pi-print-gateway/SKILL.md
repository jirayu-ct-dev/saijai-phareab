---
name: raspberry-pi-print-gateway
description: Plan, validate, deploy, or troubleshoot the Saijai LAN Print Gateway on Raspberry Pi or another shop-local host, including ARM compatibility, systemd/Docker deployment, LAN/TLS boundaries, Xprinter TCP printing, and safe verification.
---

# Raspberry Pi Print Gateway

Use this skill when the task concerns putting `print-bridge/` on a Raspberry Pi,
choosing a gateway host, creating a deployment plan, or diagnosing the browser →
gateway → Xprinter path. Read the relevant project references before making a
physical print, network change, firmware change, or production deployment.

## Desired outcome

The browser reaches a trusted gateway on the shop LAN, the gateway reaches the
confirmed printer endpoint, and the existing immediate-send print contract is
preserved. A successful deployment must have an observable health check,
persistent gateway state, a confirmed private route to the printer, and an
explicitly authorized physical test print.

Read these references as needed:

- [print-gateway-flow.md](../../../docs/print-gateway-flow.md) first when tracing
  browser → Nuxt document rendering → Gateway → printer behavior, interpreting
  an error result, or diagnosing a production incident layer by layer.
- [SETUP.md](../../../SETUP.md) for current environment ownership, health checks,
  and the step-by-step printer/Gateway IP or port change procedure.
- [deployment-plan.md](references/deployment-plan.md) for the Raspberry Pi 2
  compatibility decision, topology, installation sequence, and verification.
- [pi2-native-poc-runbook.md](references/pi2-native-poc-runbook.md) for the
  verified Pi 2 ARMv7/native-systemd path used in this workspace, including
  USB transfer, env-file ownership, and unit-file pitfalls.
- `../xprinter-xp-c260m/references/saijai-architecture.md` for the implemented
  print contract and trust boundary.
- `../xprinter-xp-c260m/references/saijai-setup.md` for current environment
  ownership, site values, HTTPS, and LAN setup.
- `../xprinter-xp-c260m/references/saijai-operations.md` for replacement and
  incident handling.
- `../xprinter-xp-c260m/references/troubleshooting.md` for layer-by-layer
  diagnosis.

## Non-negotiable project behavior

- Keep printer targets in Gateway-owned state and opaque to the browser. Never
  add an endpoint accepting an arbitrary browser-supplied host or port.
- Keep exact-origin CORS, private/loopback client checks, bounded discovery,
  rate limits, TLS requirements for non-loopback deployments, and the owner-only
  atomic state file.
- Preserve one immediate attempt per printer with a per-printer mutex. There is
  no durable queue and no automatic retry. `UNKNOWN_PROGRESS` requires physical
  inspection before a human decides whether to print again.
- Keep business data, payment QR payloads, receipt rendering, Thai rasterization,
  and printer transport responsibilities in their existing layers.
- Treat TCP connection success as transport completion, not proof that paper was
  printed, cut, or collected.

## Compatibility gate

Inspect the actual board with `uname -m`, `/etc/os-release`, `node --version`,
and `docker version` before selecting a runtime. Do not infer compatibility from
the board name alone.

For Raspberry Pi 2 Model B revision 1.1:

- Prefer Raspberry Pi OS Lite 32-bit and wired Ethernet for a small gateway.
- The current repository requires Node `>=24` for `print-bridge` and its
  Dockerfile uses `node:24-slim`. Do not claim this runs on ARMv7 until a clean
  ARMv7 test proves it; current official Node 24 release listings do not show a
  Linux ARMv7 binary.
- If the Pi 2 must be used, treat Node 22 ARMv7 plus a compatibility branch or
  a native systemd install as a separate, explicitly tested option. Changing the
  engine declaration or image tag is a source change and needs focused tests and
  a physical print check.
- Prefer a newer ARM64 Pi or another always-on host for production when the
  current Node 24 image must remain unchanged.
- Docker on 32-bit Raspberry Pi OS is a constrained option: Docker documents
  that Engine v28 is the last major version with armhf packages. On Pi 2,
  native systemd is the simpler first experiment; use Docker only after proving
  the selected arm/v7 image, Compose version, state-volume permissions, and
  restart behavior.

## Deployment shape

Use this topology:

```text
Cloud Nuxt app
    ↓ browser request
Shop browser/tablet
    ↓ trusted HTTPS gateway origin on shop LAN
Raspberry Pi gateway
    ↓ private TCP target and confirmed port
Xprinter XP-C260M
```

The public Nuxt server must not open a socket to the private printer. The
browser must reach the gateway, and the gateway must reach the printer. Use a
DHCP reservation for both the Pi and printer where possible, but keep their
addresses separate. Do not reuse the temporary hotspot printer address as the
shop address.

For a non-loopback gateway, use a stable HTTPS hostname/certificate trusted by
shop browsers and set the app's `NUXT_PUBLIC_PRINT_GATEWAY_URL` to that origin.
Use firewall/VLAN rules so the gateway is reachable only from the trusted shop
network; do not publish the printer TCP port or gateway to the public internet.

## Configuration ownership

The app host needs only browser-visible gateway settings such as:

```dotenv
NUXT_PUBLIC_PRINT_GATEWAY_ENABLED=true
NUXT_PUBLIC_PRINT_GATEWAY_URL=https://<gateway-hostname>:17321
```

The gateway host owns only `PRINT_GATEWAY_*`, including the bind address, public
URL, exact allowed app origins, confirmed printer CIDR/port, timeout and payload
limits, state path, and TLS paths. It must not receive database, Better Auth,
LINE, Cloudinary, Resend, or payment secrets.

Prefer a `/32` discovery CIDR for the confirmed printer. Confirm the printer's
actual protocol and port from its self-test/configuration; do not assume 9100
for a different unit or network interface.

## Verification sequence

1. Record board revision, OS architecture, runtime versions, printer self-test,
   printer MAC/address/port, paper width, and gateway address. Redact passwords,
   private keys, and customer receipt data.
2. Prove the runtime on the actual Pi before changing the application contract.
3. Install the gateway as a least-privilege service (native systemd is preferred
   for Pi 2; Docker may be used when the ARM image and Engine are verified).
4. Persist `/data/gateway-state.json` or its native equivalent on reliable local
   storage with owner-only permissions. Back up the trusted-printer mapping, but
   never commit it or copy secrets into it.
5. Verify `/health` from an allowed shop origin, then discover and trust the
   printer. A port check alone proves only that something is listening.
6. For HTTPS deployments, verify the certificate renewal method, timer, secret
   permissions, deploy hook, service restart, and a post-renewal health check.
7. Run software-only tests and a minimal ASCII fixture first. Add Thai raster,
   logo, QR, feed, and partial cut in stages. Physical printing is an external
   side effect and requires explicit authorization.
8. Test offline, reconnect, concurrent print attempts, restart, and
   `UNKNOWN_PROGRESS` handling. Confirm that no automatic retry or duplicate
   receipt is introduced.

## What not to inherit blindly

The user-provided Raspberry Pi usage guide is general hardware/setup guidance,
not a project authority. Its advice to add automatic retry conflicts with
Saijai's deliberate no-retry/ambiguous-progress contract. Its example IPs and
port are placeholders, and its Docker/Node compatibility is not evidence for
this repository. Prefer executable code, focused tests, the project print
references, and official platform documentation when they disagree.
