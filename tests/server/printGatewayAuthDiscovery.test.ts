import { describe, expect, it } from "vitest";
import { authenticateToken, pairingCodeFor, tokenHash, validatePairingCode } from "../../print-bridge/auth.mjs";
import { createDiscoveryService, enumerateTargets } from "../../print-bridge/discovery.mjs";

describe("LAN Print Gateway authentication", () => {
  it("accepts only current/previous pairing window and hashes bearer tokens", () => {
    const now = Date.UTC(2026, 8, 4, 0, 0, 0);
    const secret = "a-secure-test-secret-with-32-bytes";
    const code = pairingCodeFor(secret, now, 300);
    expect(code).toMatch(/^\d{6}$/);
    expect(validatePairingCode(code, secret, now, 300)).toBe(true);
    expect(validatePairingCode("000000", secret, now, 300)).toBe(false);
    const token = "a".repeat(43);
    expect(authenticateToken(`Bearer ${token}`, [{ hash: tokenHash(token), expiresAt: new Date(now + 1000).toISOString() }], now)).toBe(true);
    expect(authenticateToken(`Bearer ${token}`, [{ hash: tokenHash(token), expiresAt: new Date(now - 1).toISOString() }], now)).toBe(false);
  });
});

describe("bounded LAN discovery", () => {
  it("enumerates only usable hosts from configured CIDRs and ports", () => {
    const targets = enumerateTargets([{ network: 0xc0a80100, prefix: 30, size: 4 }], [9100]);
    expect(targets).toEqual([{ host: "192.168.1.1", port: 9100 }, { host: "192.168.1.2", port: 9100 }]);
  });

  it("returns opaque candidates and never exposes their host or port", async () => {
    const service = createDiscoveryService({
      config: {
        discoveryCidrs: [{ network: 0xc0a80100, prefix: 30, size: 4 }],
        discoveryPorts: [9100], discoveryTimeoutMs: 5, discoveryConcurrency: 2,
        rescanTtlMs: 30_000, pairingSecret: "a-secure-test-secret-with-32-bytes",
      },
      probe: async ({ host }: { host: string }) => host.endsWith(".2"),
      now: () => 1000,
    });
    const candidates = await service.scan();
    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.id).toMatch(/^candidate_/);
    expect(candidates[0]).not.toHaveProperty("host");
    expect(service.resolveCandidate(candidates[0]!.id)).toMatchObject({ host: "192.168.1.2", port: 9100 });
  });
});
