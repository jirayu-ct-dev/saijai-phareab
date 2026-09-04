import { randomUUID } from "node:crypto";
import net from "node:net";

const numberToIpv4 = (value) => [24, 16, 8, 0].map((shift) => (value >>> shift) & 255).join(".");

export function enumerateTargets(cidrs, ports) {
  const targets = [];
  for (const cidr of cidrs) {
    const firstOffset = cidr.size > 2 ? 1 : 0;
    const lastOffset = cidr.size > 2 ? cidr.size - 2 : cidr.size - 1;
    for (let offset = firstOffset; offset <= lastOffset; offset += 1) {
      for (const port of ports) targets.push({ host: numberToIpv4((cidr.network + offset) >>> 0), port });
    }
  }
  return targets;
}

export const candidateId = () => `candidate_${randomUUID()}`;

export const probeTcpTarget = ({ host, port }, timeoutMs) => new Promise((resolve) => {
  const socket = net.createConnection({ host, port });
  let settled = false;
  const finish = (available) => {
    if (settled) return;
    settled = true;
    clearTimeout(timer);
    socket.removeAllListeners();
    socket.destroy();
    resolve(available);
  };
  const timer = setTimeout(() => finish(false), timeoutMs);
  socket.once("connect", () => finish(true));
  socket.once("error", () => finish(false));
});

export function createDiscoveryService({ config, probe = probeTcpTarget, now = Date.now } = {}) {
  let lastScanAt = null;
  let candidates = new Map();

  const scan = async ({ force = false } = {}) => {
    const currentTime = now();
    if (!force && lastScanAt !== null && currentTime - lastScanAt < config.rescanTtlMs) return [...candidates.values()].map(({ id }) => ({ id }));
    const targets = enumerateTargets(config.discoveryCidrs, config.discoveryPorts);
    const next = new Map();
    let cursor = 0;
    const worker = async () => {
      while (cursor < targets.length) {
        const target = targets[cursor++];
        if (await probe(target, config.discoveryTimeoutMs)) {
          const id = candidateId();
          next.set(id, { id, ...target });
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(config.discoveryConcurrency, targets.length) }, worker));
    candidates = next;
    lastScanAt = currentTime;
    return [...candidates.values()].map(({ id }) => ({ id }));
  };

  return {
    scan,
    resolveCandidate: (id) => candidates.get(id) ?? null,
    probeTarget: (target) => probe(target, config.discoveryTimeoutMs),
  };
}
