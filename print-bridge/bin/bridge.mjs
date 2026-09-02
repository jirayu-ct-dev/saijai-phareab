#!/usr/bin/env node
/**
 * Saijai Print Bridge — CLI entry (PRN-04 Bridge MVP).
 *
 * Usage:
 *   node print-bridge/bin/bridge.mjs [--config <path>]
 *
 *   --help            print usage and exit (no connection is made)
 *   --version         print the bridge version sent in heartbeats
 *   --config <path>   local config file (default: ./config.json)
 */

import { loadConfig } from "../config.mjs";
import { createApiClient } from "../apiClient.mjs";
import { createRedactingLogger } from "../log.mjs";
import { Outbox } from "../outbox.mjs";
import { PrinterMutex } from "../mutex.mjs";
import { createJobRunner } from "../runner.mjs";
import { createBridgeLoop } from "../loop.mjs";
import { createDefaultEncodeOperations } from "../encoding.mjs";
import { createTcpTransport } from "../transport/tcp.js";
import { BRIDGE_VERSION } from "../version.mjs";

const USAGE = `Saijai Print Bridge ${BRIDGE_VERSION}

Local bridge that claims print jobs from the Saijai Phareab server and sends
them to a network thermal printer over TCP (ESC/POS bytes).

Usage:
  node print-bridge/bin/bridge.mjs [options]

Options:
  --config <path>   Path to the local config file (default: ./config.json)
  --version         Print the bridge version and exit
  --help            Print this help and exit

Config file (JSON):
  {
    "baseUrl": "https://your-saijai-host",        // server base URL
    "printerId": "printer_xxx",                    // printer registered server-side
    "bridgeCredential": "<from admin settings>",   // bearer token, keep local
    "pollIntervalMs": 15000,                       // claim poll interval
    "outboxPath": "./print-bridge-outbox.jsonl",   // durable outbox file
    "tcpTarget": { "host": "192.168.1.50", "port": 9100 }  // stays local
  }

Security:
  - The config file holds the bridge credential: keep it owner-only (chmod 600).
    The bridge refuses to start if group/others can read it.
  - The credential is never logged; the printer host/port never leaves this
    machine (it is never sent to the server).
`;

function parseArgValue(args, flag) {
  const index = args.indexOf(flag);
  if (index === -1) return undefined;
  const value = args[index + 1];
  if (!value || value.startsWith("--")) {
    process.stderr.write(`Missing value for ${flag}\n\n${USAGE}`);
    process.exit(1);
  }
  return value;
}

async function main() {
  const args = process.argv.slice(2);

  if (args.includes("--help") || args.includes("-h")) {
    process.stdout.write(USAGE);
    process.exitCode = 0;
    return;
  }
  if (args.includes("--version") || args.includes("-v")) {
    process.stdout.write(`${BRIDGE_VERSION}\n`);
    process.exitCode = 0;
    return;
  }

  const configPath = parseArgValue(args, "--config");
  const config = await loadConfig(configPath);

  const log = createRedactingLogger({ credential: config.bridgeCredential });
  const outbox = new Outbox(config.outboxPath);
  const mutex = new PrinterMutex();
  const api = createApiClient({
    baseUrl: config.baseUrl,
    bridgeCredential: config.bridgeCredential,
    printerId: config.printerId,
  });
  const encodeOperations = await createDefaultEncodeOperations();
  const createTransport = () =>
    createTcpTransport({
      host: config.tcpTarget.host,
      port: config.tcpTarget.port,
      timeoutMs: config.tcpTimeoutMs,
    });
  const runner = createJobRunner({
    printerId: config.printerId,
    api,
    encodeOperations,
    createTransport,
    outbox,
    mutex,
    log,
  });
  const loop = createBridgeLoop({ config, api, runner, outbox, log, bridgeVersion: BRIDGE_VERSION });

  let shuttingDown = false;
  const shutdown = (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    log.info(`Received ${signal}; finishing the current job, then shutting down`);
    loop.stop().catch((err) => {
      log.error("Shutdown failed", err?.message);
      process.exitCode = 1;
    });
  };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  log.info(`Print bridge ${BRIDGE_VERSION} starting for printer ${config.printerId}`);
  log.info("TCP target configured locally (host/port are never sent to the server)");
  await loop.runForever();
  log.info("Print bridge stopped; outbox flushed");
}

main().catch((err) => {
  process.stderr.write(`Print bridge failed to start: ${err?.message ?? err}\n`);
  process.exit(1);
});
