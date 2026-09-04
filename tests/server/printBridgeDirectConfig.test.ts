import { describe, expect, it } from "vitest";
import { parsePrivateIpv4Cidr, validateEnvironment } from "../../print-bridge/config.mjs";
import { createSafeLogger } from "../../print-bridge/log.mjs";

const validEnvironment = {
  PRINT_GATEWAY_BIND_HOST: "127.0.0.1",
  PRINT_GATEWAY_PORT: "17321",
  PRINT_GATEWAY_PUBLIC_URL: "http://127.0.0.1:17321",
  PRINT_GATEWAY_ALLOWED_ORIGINS: "https://shop.example.test,http://localhost:3004",
  PRINT_GATEWAY_DISCOVERY_CIDRS: "192.168.1.0/24",
  PRINT_GATEWAY_DISCOVERY_PORTS: "9100",
  PRINT_GATEWAY_STATE_PATH: "/tmp/saijai-gateway-state.json",
};

describe("LAN Print Gateway environment", () => {
  it("parses bounded private discovery and safe defaults", () => {
    expect(validateEnvironment(validEnvironment)).toMatchObject({
      bindHost: "127.0.0.1",
      port: 17321,
      publicUrl: "http://127.0.0.1:17321",
      allowedOrigins: ["https://shop.example.test", "http://localhost:3004"],
      discoveryPorts: [9100],
      discoveryConcurrency: 16,
      maxPayloadBytes: 2_000_000,
    });
    expect(parsePrivateIpv4Cidr("192.168.1.0/24")).toMatchObject({ prefix: 24, size: 256 });
  });

  it("rejects public/oversized CIDRs and wildcard origins", () => {
    expect(() => validateEnvironment({ ...validEnvironment, PRINT_GATEWAY_DISCOVERY_CIDRS: "8.8.8.0/24" })).toThrow(/private/i);
    expect(() => validateEnvironment({ ...validEnvironment, PRINT_GATEWAY_DISCOVERY_CIDRS: "10.0.0.0/8" })).toThrow(/\/24/);
    expect(() => validateEnvironment({ ...validEnvironment, PRINT_GATEWAY_ALLOWED_ORIGINS: "*" })).toThrow(/origin/i);
  });

  it("requires HTTPS and certificate paths when exposed beyond loopback", () => {
    const exposed = {
      ...validEnvironment,
      PRINT_GATEWAY_BIND_HOST: "0.0.0.0",
      PRINT_GATEWAY_PUBLIC_URL: "http://print.example.test:17321",
    };
    expect(() => validateEnvironment(exposed)).toThrow(/HTTPS/i);
    expect(validateEnvironment({
      ...exposed,
      PRINT_GATEWAY_PUBLIC_URL: "https://print.example.test:17321",
      PRINT_GATEWAY_TLS_CERT_PATH: "/run/secrets/tls.crt",
      PRINT_GATEWAY_TLS_KEY_PATH: "/run/secrets/tls.key",
    })).toMatchObject({ bindHost: "0.0.0.0", tlsCertPath: "/run/secrets/tls.crt" });
  });
});

describe("LAN Print Gateway logging", () => {
  it("emits only safe messages and allowlisted error codes", () => {
    const lines: string[] = [];
    const logger = createSafeLogger({ write: (line: string) => lines.push(line), now: () => "2026-09-03T00:00:00Z" });
    logger.warn("Immediate print failed", "UNKNOWN_PROGRESS");
    logger.error("Rejected detail", "contains host 192.0.2.10");
    expect(JSON.parse(lines[0] ?? "{}")).toMatchObject({ level: "warn", code: "UNKNOWN_PROGRESS" });
    expect(lines.join("\n")).not.toContain("192.0.2.10");
  });
});
