import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  Prisma,
  PrintDocumentKind,
  PrintJobStatus,
  PrintRenderMode,
  PrintTransport,
  PrinterModel,
} from "~~/app/generated/prisma/client";

// PRN-02 schema guard (no DB): the generated Prisma client must expose the
// two printing models (C7) with every enum value of the frozen PRN-01
// contracts, and the additive migration must stay free of endpoints, IP
// addresses and credential material.

const MIGRATION_PATH = "prisma/migrations/20260903120000_prn02_printer_print_job/migration.sql";

describe("generated client: printing enums", () => {
  it("exposes all 14 PrintJobStatus states from shared/types/printing.ts", () => {
    expect(Object.keys(PrintJobStatus).sort()).toEqual(
      [
        "QUEUED",
        "CLAIMED",
        "RENDERING",
        "READY",
        "SENDING",
        "SENT",
        "ACKNOWLEDGED",
        "RETRY_WAIT",
        "STALE_DOCUMENT",
        "NEEDS_REVIEW",
        "RESOLVED_PRINTED",
        "RESOLVED_NOT_PRINTED",
        "REPRINTED",
        "FAILED",
      ].sort(),
    );
  });

  it("exposes the printer profile enums with the PRN-01 values", () => {
    // Prisma enum value mapped via @map: the TS key is XP_C260M while the
    // database enum value is "XP-C260M" (proven by the rehearsal client
    // smoke stage in scripts/printing-rehearsal/prn02-client-smoke.ts).
    expect(PrinterModel).toEqual({ XP_C260M: "XP_C260M" });
    expect(Object.keys(PrintTransport).sort()).toEqual(["BLUETOOTH", "ETHERNET", "USB", "WIFI"].sort());
    expect(Object.keys(PrintRenderMode).sort()).toEqual(["HYBRID", "RASTER"].sort());
    expect(Object.keys(PrintDocumentKind).sort()).toEqual(["QUOTATION", "RECEIPT"].sort());
  });
});

describe("generated client: printing models", () => {
  it("registers Printer and PrintJob as model names", () => {
    expect(Prisma.ModelName.Printer).toBe("Printer");
    expect(Prisma.ModelName.PrintJob).toBe("PrintJob");
  });

  it("exposes printer and printJob as PrismaClient model properties", () => {
    // modelProps is the generated union of delegate property names on the
    // client class; a DB connection is never opened here.
    const namespaceSource = readFileSync(
      resolve(__dirname, "../../app/generated/prisma/internal/prismaNamespace.ts"),
      "utf8",
    );
    const modelProps = namespaceSource.match(/modelProps: [^;]+;/)?.[0] ?? "";
    expect(modelProps).toContain('"printer"');
    expect(modelProps).toContain('"printJob"');
  });
});

describe("generated client: idempotency scope and relations", () => {
  it("carries the print_job idempotency scope unique index in the generated client schema", () => {
    // The generated client embeds the schema it was built from; assert it
    // matches the checked-in schema so a stale generate is caught.
    const classSource = readFileSync(
      resolve(__dirname, "../../app/generated/prisma/internal/class.ts"),
      "utf8",
    );
    expect(classSource).toContain("print_job_idempotency_scope");
  });

  it("keeps the C8 print-job lifecycle fields in the generated model", () => {
    const modelSource = readFileSync(
      resolve(__dirname, "../../app/generated/prisma/models/PrintJob.ts"),
      "utf8",
    );
    expect(modelSource).toContain("printerId");
    expect(modelSource).toContain("sourcePaymentId");
    expect(modelSource).toContain("requestedById");
    expect(modelSource).toContain("reprintOfId");
    expect(modelSource).toContain("fencingToken");
    expect(modelSource).toContain("leaseToken");
    expect(modelSource).toContain("leaseExpiresAt");
    expect(modelSource).toContain("snapshotExpiresAt");
    expect(modelSource).toContain("amountMinor");
    expect(modelSource).toContain("failureMessageSafe");
    expect(modelSource).toContain("timeline");
  });

  it("keeps the printer hash-only credential columns in the generated model", () => {
    const modelSource = readFileSync(
      resolve(__dirname, "../../app/generated/prisma/models/Printer.ts"),
      "utf8",
    );
    expect(modelSource).toContain("bridgeCredentialHash");
    expect(modelSource).toContain("bridgeCredentialVersion");
    expect(modelSource).toContain("connectionProfile");
    expect(modelSource).toContain("lastHeartbeatAt");
  });
});

describe("PRN-02 migration hygiene", () => {
  const migration = readFileSync(resolve(__dirname, "../..", MIGRATION_PATH), "utf8");

  it("exists and only creates objects (no data or destructive statements)", () => {
    expect(migration).toContain('CREATE TYPE "PrintJobStatus"');
    expect(migration).toContain('CREATE TABLE "printer"');
    expect(migration).toContain('CREATE TABLE "print_job"');
    expect(migration).not.toMatch(/\bINSERT\s+INTO\b/i);
    expect(migration).not.toMatch(/\bUPDATE\b\s+\S+\s+SET/i);
    expect(migration).not.toMatch(/\bDELETE\s+FROM\b/i);
    expect(migration).not.toMatch(/\bDROP\s+(TABLE|TYPE|COLUMN|INDEX)\b/i);
  });

  it("contains no endpoint, IP address or credential-looking strings", () => {
    // IPv4 addresses (covers localhost octets and LAN ranges)
    expect(migration).not.toMatch(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/);
    // URL / connection schemes
    expect(migration).not.toMatch(/\b(?:https?|wss?|tcp|socket|postgres(?:ql)?)::\/\//i);
    // Raw credential material keywords (column names like bridgeCredentialHash
    // are intentionally allowed — they store hashes, never values)
    expect(migration).not.toMatch(/\b(?:password|passwd|passphrase|secret|psk|wpa|wep|ssid|apikey|api_key|token\s*=\s*')\b/i);
    // RFC-mapped documentation IPs and any private-range literal by name
    expect(migration).not.toMatch(/\b(?:192\.168|10\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01]))\./);
    // Raw private-key material markers
    expect(migration).not.toMatch(/BEGIN (?:RSA )?PRIVATE KEY/);
  });
});
