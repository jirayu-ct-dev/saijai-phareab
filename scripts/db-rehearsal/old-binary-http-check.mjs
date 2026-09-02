#!/usr/bin/env node

import { writeFile } from "node:fs/promises";
import { hashPassword } from "better-auth/crypto";
import { Client } from "pg";

const args = process.argv.slice(2);

const argValue = (flag) => {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
};

const failUsage = (message) => {
  console.error(message);
  process.exit(64);
};

if (!args.includes("--confirm-disposable")) {
  failUsage("refusing to run without --confirm-disposable");
}

const databaseUrl = process.env.DATABASE_URL;
const baseUrlValue = argValue("--base-url");
const reportFile = argValue("--report-file");
const password = process.env.OLD_BINARY_TEST_PASSWORD;

if (!databaseUrl || !baseUrlValue || !reportFile || !password) {
  failUsage(
    "DATABASE_URL, OLD_BINARY_TEST_PASSWORD, --base-url and --report-file are required",
  );
}

let parsedDatabaseUrl;
let baseUrl;
try {
  parsedDatabaseUrl = new URL(databaseUrl);
  baseUrl = new URL(baseUrlValue);
} catch {
  failUsage("database and application URLs must be valid URLs");
}

const loopbackHosts = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);
const databaseName = parsedDatabaseUrl.pathname.replace(/^\//, "");
if (!loopbackHosts.has(parsedDatabaseUrl.hostname) || !databaseName.startsWith("rehearsal")) {
  failUsage("database must be loopback and its name must start with rehearsal");
}
if (!loopbackHosts.has(baseUrl.hostname) || baseUrl.protocol !== "http:") {
  failUsage("old application must be served over loopback HTTP");
}

const ADMIN_EMAIL = "fixture-admin@example.test";
const UPDATED_SHOP = {
  name: "Fixture Laundry Rollback",
  phone: "028888888",
  address: "Fixture Address After Old App",
  logoUrl: null,
  lineQrImageUrl: null,
};
const PUBLIC_KEYS = new Set([
  "name",
  "phone",
  "address",
  "logoUrl",
  "lineQrImageUrl",
  "washFoldPricePerKg",
]);

const assertions = [];
const record = (name, detail) => assertions.push({ name, pass: true, detail });
const assert = (condition, name, detail) => {
  if (!condition) throw new Error(`${name}: ${detail}`);
  record(name, detail);
};

const db = new Client({
  connectionString: databaseUrl,
  statement_timeout: 30_000,
  connectionTimeoutMillis: 10_000,
});

const requestJson = async (pathname, options = {}) => {
  const response = await fetch(new URL(pathname, baseUrl), options);
  const text = await response.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!response.ok) {
    throw new Error(`${options.method ?? "GET"} ${pathname} returned HTTP ${response.status}`);
  }
  return { response, body };
};

try {
  await db.connect();

  // Prepare a credential account using Better Auth's real password hashing
  // contract, then authenticate through the old binary's real HTTP endpoint.
  // No session row or cookie is fabricated by this harness.
  const passwordHash = await hashPassword(password);
  await db.query(
    `INSERT INTO "account"
       (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt")
     VALUES ($1, $2, 'credential', $2, $3, NOW(), NOW())
     ON CONFLICT (id) DO UPDATE SET password = EXCLUDED.password, "updatedAt" = NOW()`,
    ["fxacct_old_binary", "fxu_admin", passwordHash],
  );

  const publicBefore = await requestJson("/api/public/shop-settings");
  assert(publicBefore.body?.name === "Fixture Laundry", "public-settings-read", "legacy shop singleton returned");
  assert(
    Object.keys(publicBefore.body ?? {}).every((key) => PUBLIC_KEYS.has(key)),
    "public-settings-allowlist",
    "response contains only the six public fields",
  );

  const login = await requestJson("/api/auth/sign-in/email", {
    method: "POST",
    headers: { "content-type": "application/json", origin: baseUrl.origin },
    body: JSON.stringify({ email: ADMIN_EMAIL, password }),
  });
  const sessionCookie = login.response.headers
    .getSetCookie()
    .map((value) => value.split(";", 1)[0])
    .find((value) => value.startsWith("better-auth.session_token="));
  assert(Boolean(sessionCookie), "better-auth-login", "actual sign-in endpoint issued a signed session cookie");

  const authHeaders = { cookie: sessionCookie };
  const session = await requestJson("/api/auth/session-status", { headers: authHeaders });
  assert(session.body?.user?.role === "ADMIN", "authenticated-session", "middleware resolved fixture admin role");

  const shop = await requestJson("/api/admin/settings/shop", { headers: authHeaders });
  assert(shop.body?.name === "Fixture Laundry", "admin-shop-read", "authenticated legacy shop read succeeded");

  const business = await requestJson("/api/admin/settings/business", { headers: authHeaders });
  assert(
    business.body?.washFoldPricePerKg === 60,
    "admin-business-read",
    "old BusinessSetting Prisma model works against expanded table",
  );

  const addonOrder = await requestJson("/api/admin/service-orders/fxso5", { headers: authHeaders });
  assert(
    Array.isArray(addonOrder.body?.addonUsages)
      && addonOrder.body.addonUsages.length === 1
      && addonOrder.body.addonUsages[0]?.deductedAt,
    "backfilled-addon-read",
    "old endpoint reads the active DB-05 ledger row and excludes the refunded row by contract",
  );

  const photoOrder = await requestJson("/api/admin/service-orders/fxso2", { headers: authHeaders });
  const photoItem = photoOrder.body?.items?.find((item) => item.id === "fxsoi4");
  assert(
    photoItem?.image?.id === "fximg1" && photoItem?.photos?.some((photo) => photo.imageId === "fximg1"),
    "backfilled-photo-read",
    "old endpoint sees both direct image and DB-05 join row",
  );

  const receipt = await requestJson("/api/admin/payments/fxpay2/receipt", { headers: authHeaders });
  assert(
    receipt.body?.serviceOrder?.deliveredAt === "2026-08-02T10:00:00.000Z",
    "legacy-completed-order-read",
    "old receipt path derives deliveredAt from service_order.updatedAt",
  );

  const beforeWrite = await db.query(
    `SELECT s.name AS legacy_name, b.name AS target_name
       FROM "shop_setting" s CROSS JOIN "business_setting" b
      WHERE s.id = 'singleton' AND b.id = 'singleton'`,
  );
  assert(
    beforeWrite.rows[0]?.legacy_name === beforeWrite.rows[0]?.target_name,
    "pre-write-settings-equality",
    "legacy and target names match before old-only write",
  );

  await requestJson("/api/admin/settings/shop", {
    method: "PUT",
    headers: { ...authHeaders, "content-type": "application/json", origin: baseUrl.origin },
    body: JSON.stringify(UPDATED_SHOP),
  });

  const shopAfter = await requestJson("/api/admin/settings/shop", { headers: authHeaders });
  const publicAfter = await requestJson("/api/public/shop-settings");
  assert(shopAfter.body?.name === UPDATED_SHOP.name, "legacy-write-readback", "old admin endpoint reads its write");
  assert(publicAfter.body?.name === UPDATED_SHOP.name, "public-write-readback", "public endpoint reads old-only write");

  const afterWrite = await db.query(
    `SELECT s.name AS legacy_name, b.name AS target_name
       FROM "shop_setting" s CROSS JOIN "business_setting" b
      WHERE s.id = 'singleton' AND b.id = 'singleton'`,
  );
  assert(
    afterWrite.rows[0]?.legacy_name === UPDATED_SHOP.name,
    "legacy-source-updated",
    "shop_setting contains the old application write",
  );
  assert(
    afterWrite.rows[0]?.target_name === "Fixture Laundry",
    "expected-target-staleness",
    "business_setting target remains unchanged and requires compatibility resync",
  );

  const preservation = await db.query(`
    SELECT
      to_regclass('public.shop_setting') IS NOT NULL AS shop_setting_exists,
      to_regclass('public.notification_setting') IS NOT NULL AS notification_setting_exists,
      (SELECT COUNT(*)::int FROM "service_order" WHERE id = 'fxso5' AND "addonUsages" IS NOT NULL) AS addon_json_rows,
      (SELECT COUNT(*)::int FROM "service_order_item" WHERE id = 'fxsoi4' AND "imageId" = 'fximg1') AS direct_image_rows,
      (SELECT COUNT(*)::int FROM "service_order_addon_usage" WHERE "serviceOrderId" = 'fxso5') AS addon_ledger_rows,
      (SELECT COUNT(*)::int FROM "service_order_item_image" WHERE "serviceOrderItemId" = 'fxsoi4') AS image_join_rows,
      (SELECT COUNT(*)::int FROM "service_order" WHERE id = 'fxso1' AND status = 'COMPLETED' AND "completedAt" IS NULL) AS legacy_completed_rows
  `);
  const preserved = preservation.rows[0];
  assert(preserved.shop_setting_exists, "shop-source-preserved", "shop_setting still exists");
  assert(preserved.notification_setting_exists, "notification-source-preserved", "notification_setting still exists");
  assert(Number(preserved.addon_json_rows) === 1, "addon-json-preserved", "legacy add-on JSON remains");
  assert(Number(preserved.direct_image_rows) === 1, "direct-image-preserved", "legacy direct imageId remains");
  assert(Number(preserved.addon_ledger_rows) === 2, "addon-ledger-preserved", "normalized add-on rows remain");
  assert(Number(preserved.image_join_rows) === 1, "image-join-preserved", "normalized image join remains");
  assert(Number(preserved.legacy_completed_rows) === 1, "completed-source-preserved", "legacy completed row remains unstamped");

  const report = {
    ok: true,
    authentication: "Better Auth credential account + actual POST /api/auth/sign-in/email",
    paths: [
      "GET /api/public/shop-settings",
      "POST /api/auth/sign-in/email",
      "GET /api/auth/session-status",
      "GET /api/admin/settings/shop",
      "GET /api/admin/settings/business",
      "GET /api/admin/service-orders/fxso5",
      "GET /api/admin/service-orders/fxso2",
      "GET /api/admin/payments/fxpay2/receipt",
      "PUT /api/admin/settings/shop",
    ],
    assertions,
    oldOnlyWrite: {
      legacyBefore: beforeWrite.rows[0].legacy_name,
      targetBefore: beforeWrite.rows[0].target_name,
      legacyAfter: afterWrite.rows[0].legacy_name,
      targetAfter: afterWrite.rows[0].target_name,
      resyncRequired: true,
    },
  };
  await writeFile(reportFile, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
  console.log(JSON.stringify({ ok: true, checks: assertions.length, reportFile }));
} catch (error) {
  const report = {
    ok: false,
    error: error instanceof Error ? error.message : "unknown failure",
    assertions,
  };
  await writeFile(reportFile, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 }).catch(() => {});
  console.error(JSON.stringify({ ok: false, error: report.error }));
  process.exitCode = 1;
} finally {
  await db.end().catch(() => {});
}
