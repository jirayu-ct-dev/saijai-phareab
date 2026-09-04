#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { loadConfig } from "../config.mjs";
import { pairingCodeFor } from "../auth.mjs";
import { createDiscoveryService } from "../discovery.mjs";
import { createSafeLogger } from "../log.mjs";
import { createPrintGatewayServer, listenPrintGateway } from "../server.mjs";
import { createFileStateStore } from "../state.mjs";
import { BRIDGE_VERSION } from "../version.mjs";

const USAGE = `Saijai LAN Print Gateway ${BRIDGE_VERSION}

Usage:
  node --env-file=.env print-bridge/bin/bridge.mjs
  node --env-file=.env print-bridge/bin/bridge.mjs --pairing-code
  node print-bridge/bin/bridge.mjs --help

Configuration is read only from PRINT_GATEWAY_* environment variables.
`;

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) return process.stdout.write(USAGE);
  if (args.includes("--version") || args.includes("-v")) return process.stdout.write(`${BRIDGE_VERSION}\n`);
  const config = await loadConfig();
  if (args.includes("--pairing-code")) {
    process.stdout.write(`${pairingCodeFor(config.pairingSecret, Date.now(), config.pairingCodeTtlSeconds)}\n`);
    return;
  }
  const tls = config.tlsCertPath ? { cert: await readFile(config.tlsCertPath), key: await readFile(config.tlsKeyPath) } : null;
  const log = createSafeLogger();
  const server = createPrintGatewayServer({
    config,
    stateStore: createFileStateStore(config.statePath),
    discovery: createDiscoveryService({ config }),
    log,
    tls,
  });
  await listenPrintGateway(server, config);
  log.info("LAN Print Gateway started");
  let stopping = false;
  const stop = () => {
    if (stopping) return;
    stopping = true;
    server.close((error) => {
      if (error) { log.error("LAN Print Gateway shutdown failed", "SHUTDOWN_FAILED"); process.exitCode = 1; }
    });
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}

main().catch((error) => {
  process.stderr.write(`Print Gateway failed to start: ${error?.message ?? "unknown error"}\n`);
  process.exit(1);
});
