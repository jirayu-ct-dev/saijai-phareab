/**
 * DB-05 / G2 rollback rehearsal helper: verifies the OLD application read
 * paths still work on a backfilled disposable database.
 *
 * The backfill must never mutate legacy sources (shop_setting,
 * notification_setting, service_order.addonUsages JSON, service_order_item
 * imageId, legacy business_setting columns). This check re-reads those rows
 * the way the pre-consolidation application did and fails if any expected
 * legacy value is gone.
 *
 * Usage:
 *   pnpm exec tsx scripts/db-rehearsal/backfill/legacy-read-check.mts \
 *     --url postgresql://...@127.0.0.1:5439/rehearsal_b --confirm-disposable
 */
import { Client } from "pg";

const usageError = (message: string): never => {
  console.error(`[legacy-read-check] ${message}`);
  process.exit(64);
};

const args = process.argv.slice(2);
let url = "";
let confirmed = false;
for (let i = 0; i < args.length; i += 1) {
  if (args[i] === "--confirm-disposable") confirmed = true;
  else if (args[i] === "--url") url = args[i + 1] ?? "";
}
if (!confirmed) usageError("--confirm-disposable is required");
if (!url) usageError("--url is required");

const target = new URL(url);
if (!["127.0.0.1", "localhost", "::1"].includes(target.hostname)) {
  usageError("refusing to run against a non-loopback host");
}
if (!target.pathname.replace(/^\//, "").startsWith("rehearsal")) {
  usageError("refusing to run against a database not named rehearsal*");
}

const client = new Client({ connectionString: url });
await client.connect();

const scalar = async (sql: string, values: unknown[] = []): Promise<string> => {
  const result = await client.query(sql, values);
  if (result.rows.length === 0) throw new Error(`no row: ${sql}`);
  return String(Object.values(result.rows[0])[0]);
};

const checks: Array<[string, string, string]> = [];
const expect = (label: string, actual: string, expected: string) =>
  checks.push([label, actual, expected]);

// Legacy shop row (read by documents/UI/print flows).
expect("shop_setting.name", await scalar(`SELECT name FROM shop_setting WHERE id = 'singleton'`), "Fixture Laundry");
expect("shop_setting.phone", await scalar(`SELECT phone FROM shop_setting WHERE id = 'singleton'`), "029999999");

// Legacy notification row (read by notify paths).
for (const field of ["notifyCustomerOnQuotation", "notifyStaffOnNewOrder", "notifyCustomerOnPackageExpiring"]) {
  expect(
    `notification_setting.${field}`,
    await scalar(`SELECT "${field}" FROM notification_setting WHERE id = 'singleton'`),
    "true",
  );
}

// Legacy business_setting columns (read by pricing/receipt paths). Decimals
// come back at full numeric precision, so compare numerically.
expect("business_setting.hangerPricePerUnit", String(Number(await scalar(`SELECT "hangerPricePerUnit" FROM business_setting WHERE id = 'singleton'`))), "10");
expect("business_setting.orderNoPrefix", await scalar(`SELECT "orderNoPrefix" FROM business_setting WHERE id = 'singleton'`), "ORD-");

// Legacy service-order data untouched by the backfill.
expect("fxso1 legacy COMPLETED completedAt is null", await scalar(`SELECT "completedAt" IS NULL FROM service_order WHERE id = 'fxso1'`), "true");
expect("fxso3 addonUsages JSON intact", await scalar(`SELECT jsonb_array_length("addonUsages") FROM service_order WHERE id = 'fxso3'`), "1");
expect("fxso5 addonUsages JSON intact", await scalar(`SELECT jsonb_array_length("addonUsages") FROM service_order WHERE id = 'fxso5'`), "2");
expect("fxsoi1 direct imageId intact", await scalar(`SELECT "imageId" FROM service_order_item WHERE id = 'fxsoi1'`), "fximg1");

await client.end();

let failed = 0;
for (const [label, actual, expected] of checks) {
  if (actual === expected) {
    console.log(`ok   ${label}`);
  } else {
    failed += 1;
    console.error(`FAIL ${label}: expected ${expected}, got ${actual}`);
  }
}
if (failed > 0) {
  console.error(`[legacy-read-check] ${failed} check(s) failed`);
  process.exit(1);
}
console.log(`[legacy-read-check] all ${checks.length} legacy read-path checks passed`);
