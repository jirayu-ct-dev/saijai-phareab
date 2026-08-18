import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "prisma/migrations/20260818000000_add_reusable_customer_accounts/migration.sql",
  ),
  "utf8",
);
const migrationRoot = resolve(process.cwd(), "prisma/migrations");
const migrationsAfterReusableCustomers = readdirSync(migrationRoot)
  .filter((name) => /^\d/.test(name) && name > "20260818000000_add_reusable_customer_accounts")
  .sort()
  .map((name) => readFileSync(resolve(migrationRoot, name, "migration.sql"), "utf8"))
  .join("\n");

describe("reusable customer migration invariants", () => {
  it("keeps active customer phone uniqueness as a partial index", () => {
    expect(migration).toMatch(
      /CREATE UNIQUE INDEX "user_normalizedPhoneNumber_active_key"[\s\S]*WHERE "deletedAt" IS NULL AND "normalizedPhoneNumber" IS NOT NULL;/,
    );
    expect(migrationsAfterReusableCustomers).not.toContain(
      'DROP INDEX "user_normalizedPhoneNumber_active_key"',
    );
  });

  it("allows only one active claim token per customer", () => {
    expect(migration).toMatch(
      /CREATE UNIQUE INDEX "customer_claim_token_userId_active_key"[\s\S]*WHERE "usedAt" IS NULL AND "revokedAt" IS NULL;/,
    );
    expect(migrationsAfterReusableCustomers).not.toContain(
      'DROP INDEX "customer_claim_token_userId_active_key"',
    );
  });

  it("preserves claim tokens when their issuing staff user is removed", () => {
    expect(migration).toMatch(/"createdById" TEXT,/);
    expect(migration).toMatch(
      /customer_claim_token_createdById_fkey[\s\S]*ON DELETE SET NULL ON UPDATE CASCADE;/,
    );
  });

  it("keeps the SQL backfill formatting set aligned with the phone utility", () => {
    expect(migration).toContain(
      "' -()' || chr(9) || chr(10) || chr(11) || chr(12) || chr(13) || chr(160)",
    );
  });
});
