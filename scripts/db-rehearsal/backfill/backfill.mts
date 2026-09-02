/**
 * DB-05 idempotent backfill runner (disposable databases only).
 *
 * Operations (docs/plan-database-consolidation.md section 6, Phase 4):
 *   settings-consolidation     shop_setting/notification_setting -> business_setting
 *   addon-usage-json-to-ledger service_order.addonUsages JSON -> service_order_addon_usage
 *   item-photo-direct-to-join  service_order_item.imageId -> service_order_item_image
 *
 * Contract: scripts/db-rehearsal/backfill-report-contract.ts (report shape,
 * idempotency rule, exit codes). The add-on parser is the application's own
 * `parseAddonUsages`, imported from server/utils/serviceOrderCredits.ts so the
 * backfill cannot drift from application semantics.
 *
 * Safety guards: exactly one target confirmation. `--confirm-disposable`
 * requires a loopback URL whose database name starts with "rehearsal";
 * `--confirm-production` (Approval C, packet section 5) refuses loopback and
 * rehearsal* targets, requires an explicit sslmode=require (or stronger) URL,
 * and requires `--ssl-root-cert` pointing at the provider CA PEM — the node
 * pg driver treats `sslmode=require` as full verification, so the provider CA
 * must be trusted explicitly (run-preflight.mjs does the same). Reads .env
 * never; the URL must be passed explicitly for the process.
 *
 * Usage:
 *   pnpm exec tsx scripts/db-rehearsal/backfill/backfill.mts \
 *     --operation addon-usage-json-to-ledger --mode dry-run \
 *     --url postgresql://postgres:...@127.0.0.1:5439/rehearsal_db05 \
 *     --confirm-disposable [--report-file /path/report.json]
 *
 * Exit codes: 0 ok / 1 mismatches / 2 unapproved quarantine / 3 aborted /
 * 64 usage. Pure planning helpers are exported for focused tests; the CLI
 * entry point is skipped under Vitest.
 */
import { pathToFileURL } from "node:url";
import { readFileSync, writeFileSync } from "node:fs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../../app/generated/prisma/client";
import {
  NOTIFICATION_FIELDS,
  classifyAddonOrder,
  planImageJoins,
  planSettingsCopy,
} from "./plan.mts";
import type { ClassifiedAddonEntry, LegacyShopShape, TargetSettingsShape } from "./plan.mts";
import type {
  BackfillMismatch,
  BackfillMode,
  BackfillOperation,
  BackfillReport,
  QuarantineEntry,
} from "../backfill-report-contract";

type TxClient = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];
type Db = PrismaClient | TxClient;

const OPERATIONS: BackfillOperation[] = [
  "settings-consolidation",
  "addon-usage-json-to-ledger",
  "item-photo-direct-to-join",
];

// ===========================================================================
// Operations (DB access; apply runs inside one transaction)
// ===========================================================================

const runSettingsConsolidation = async (db: Db, mode: BackfillMode) => {
  const rowsScanned = 3;
  const mismatches: BackfillMismatch[] = [];
  let rowsChanged = 0;

  const [legacyShopBefore, legacyNotificationBefore, targetBefore] = await Promise.all([
    db.shopSetting.findUnique({ where: { id: "singleton" } }),
    db.notificationSetting.findUnique({ where: { id: "singleton" } }),
    db.appSetting.findUnique({ where: { id: "singleton" } }),
  ]);

  // Ensure the singletons exist per policy, but only pre-existing legacy rows
  // count as authoritative sources (a row we just created holds only defaults).
  const legacyShop: LegacyShopShape | null = legacyShopBefore
    ? {
        name: legacyShopBefore.name,
        phone: legacyShopBefore.phone,
        address: legacyShopBefore.address,
        logoUrl: legacyShopBefore.logoUrl,
        lineQrImageUrl: legacyShopBefore.lineQrImageUrl,
      }
    : null;
  const legacyNotification = legacyNotificationBefore
    ? Object.fromEntries(NOTIFICATION_FIELDS.map((f) => [f, legacyNotificationBefore[f]]))
    : null;

  let target = targetBefore;
  if (!target && mode === "apply") {
    target = await db.appSetting.create({ data: { id: "singleton" } });
  }

  const plan = planSettingsCopy(legacyShop, legacyNotification, target);
  mismatches.push(...plan.mismatches);

  if (mode === "apply" && Object.keys(plan.updateData).length > 0) {
    await db.appSetting.update({ where: { id: "singleton" }, data: plan.updateData });
  }
  if (Object.keys(plan.updateData).length > 0) rowsChanged += 1;
  if (!targetBefore && mode === "apply") rowsChanged += 1;

  return { rowsScanned, rowsChanged, mismatches, quarantine: [] as QuarantineEntry[] };
};

export const runAddonJsonToLedger = async (db: Db, mode: BackfillMode) => {
  const orders = (await db.serviceOrder.findMany({
    where: { deletedAt: null },
    select: { id: true, addonUsages: true },
  })).filter((order) => Array.isArray(order.addonUsages) && order.addonUsages.length > 0);
  const rowsScanned = orders.length;
  const quarantine: QuarantineEntry[] = [];
  const mismatches: BackfillMismatch[] = [];
  let rowsChanged = 0;

  for (const order of orders) {
    const classified = classifyAddonOrder(order.addonUsages);

    if (classified.invalidJson) {
      quarantine.push({
        subjectId: order.id,
        subjectPart: null,
        reason: "invalid-json",
        detail: "addonUsages is not an array",
        disposition: "pending",
      });
      continue;
    }

    for (const bad of classified.quarantine) {
      quarantine.push({
        subjectId: order.id,
        subjectPart: `entry:${bad.index}`,
        reason: bad.reason,
        detail: bad.reason === "missing-entitlement" ? undefined : "entry rejected by the application parser",
        disposition: "pending",
      });
    }
    if (classified.quarantine.length > 0) {
      // Fail closed: an order with any quarantined entry is not migrated at
      // all until it gets an approved disposition — partial migration could
      // break JSON-vs-ledger credits parity for pairs the reconciliation
      // check still counts from the raw JSON.
      continue;
    }

    // Entitlement existence is verified for ALL valid entries before any
    // write: an order with a missing entitlement is quarantined whole and
    // gets no ledger rows at all — a partial migration could break the
    // JSON-vs-ledger credits parity the reconciliation check still counts
    // from the raw JSON. Never guessed, never created, legacy JSON untouched.
    const entitlementIds = [...new Set(classified.valid.map((entry) => entry.entitlementId))];
    const foundEntitlementIds = new Set(
      entitlementIds.length > 0
        ? (
            await db.memberEntitlement.findMany({
              where: { id: { in: entitlementIds } },
              select: { id: true },
            })
          ).map((row) => row.id)
        : [],
    );
    let orderHasMissingEntitlement = false;
    for (const entry of classified.valid) {
      if (!foundEntitlementIds.has(entry.entitlementId)) {
        orderHasMissingEntitlement = true;
        quarantine.push({
          subjectId: order.id,
          subjectPart: `entry:${entry.index}`,
          reason: "missing-entitlement",
          detail: "referenced entitlement does not exist",
          disposition: "pending",
        });
      }
    }
    if (orderHasMissingEntitlement) continue;

    const byEntitlement = new Map<string, ClassifiedAddonEntry[]>();
    for (const entry of classified.valid) {
      const bucket = byEntitlement.get(entry.entitlementId) ?? [];
      bucket.push(entry);
      byEntitlement.set(entry.entitlementId, bucket);
    }

    for (const [entitlementId, entries] of byEntitlement) {
      const ledgerRows = await db.serviceOrderAddonUsage.findMany({
        where: { serviceOrderId: order.id, memberEntitlementId: entitlementId },
        select: { credits: true },
      });
      const ledgerTotal = ledgerRows.reduce((sum, row) => sum + row.credits, 0);
      const jsonTotal = entries.reduce((sum, entry) => sum + entry.credits, 0);

      if (ledgerTotal === jsonTotal) continue; // already migrated — idempotent skip
      if (ledgerTotal !== 0) {
        // Divergent pair: never overwrite or delete; report and move on.
        mismatches.push({
          checkId: "credits_json_vs_ledger",
          subjectId: order.id,
          detail: `entitlement:${entitlementId} ledger:${ledgerTotal} json:${jsonTotal}`,
        });
        continue;
      }

      if (mode === "apply") {
        await db.serviceOrderAddonUsage.createMany({
          data: entries.map((entry) => ({
            serviceOrderId: order.id,
            memberEntitlementId: entry.entitlementId,
            productId: entry.productId ?? null,
            productName: entry.productName ?? null,
            credits: entry.credits,
            deductOn: entry.deductOn,
            isDelivery: entry.isDelivery ?? false,
            deductedAt: entry.deductedAt ? new Date(entry.deductedAt) : null,
            refundedAt: entry.refundedAt ? new Date(entry.refundedAt) : null,
          })),
        });
      }
      rowsChanged += entries.length;
    }
  }

  return { rowsScanned, rowsChanged, mismatches, quarantine };
};

const runItemPhotoDirectToJoin = async (db: Db, mode: BackfillMode) => {
  const items = await db.serviceOrderItem.findMany({
    where: { imageId: { not: null } },
    select: { id: true, imageId: true },
  });
  const rowsScanned = items.length;
  const quarantine: QuarantineEntry[] = [];

  const imageIds = new Set(
    (await db.image.findMany({ where: { id: { in: items.map((item) => item.imageId) } }, select: { id: true } })).map(
      (image) => image.id,
    ),
  );
  const existingPairs = new Set(
    (
      await db.serviceOrderItemImage.findMany({
        where: { serviceOrderItemId: { in: items.map((item) => item.id) } },
        select: { serviceOrderItemId: true, imageId: true },
      })
    ).map((row) => `${row.serviceOrderItemId}::${row.imageId}`),
  );

  const plan = planImageJoins(
    items.map((item) => ({ id: item.id, imageId: item.imageId as string })),
    existingPairs,
    imageIds,
  );

  for (const bad of plan.quarantine) {
    quarantine.push({
      subjectId: bad.serviceOrderItemId,
      subjectPart: null,
      reason: "missing-image",
      detail: "direct imageId has no image row",
      disposition: "pending",
    });
  }

  if (mode === "apply" && plan.creates.length > 0) {
    await db.serviceOrderItemImage.createMany({
      data: plan.creates.map((create) => ({
        serviceOrderItemId: create.serviceOrderItemId,
        imageId: create.imageId,
        sortOrder: 0,
        isDamaged: false,
      })),
    });
  }

  return { rowsScanned, rowsChanged: plan.creates.length, mismatches: [] as BackfillMismatch[], quarantine };
};

// ===========================================================================
// CLI
// ===========================================================================

const usageError = (message: string): never => {
  console.error(`[backfill] ${message}`);
  console.error(
    "usage: backfill.mts --operation <op> --mode <dry-run|apply> --url <postgresql://...> (--confirm-disposable | --confirm-production) [--report-file PATH]",
  );
  process.exit(64);
};

const parseArgs = (argv: string[]) => {
  const args: Record<string, string> = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith("--")) usageError(`unexpected argument: ${arg}`);
    if (arg === "--confirm-disposable" || arg === "--confirm-production") {
      args[arg.slice(2)] = "1";
      continue;
    }
    const value = argv[i + 1];
    if (value === undefined) usageError(`missing value for ${arg}`);
    args[arg.slice(2).replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())] = value;
    i += 1;
  }
  return args;
};

const main = async (): Promise<never> => {
  const args = parseArgs(process.argv.slice(2));
  const operation = args.operation as BackfillOperation;
  const mode = args.mode as BackfillMode;

  if (!OPERATIONS.includes(operation)) usageError(`unknown --operation: ${args.operation ?? "(missing)"}`);
  if (mode !== "dry-run" && mode !== "apply") usageError(`--mode must be dry-run or apply, got: ${args.mode ?? "(missing)"}`);
  if (!args.url) usageError("--url is required");
  const disposableMode = args["confirm-disposable"] === "1";
  const productionMode = args["confirm-production"] === "1";
  if (disposableMode === productionMode) {
    usageError("pass exactly one of --confirm-disposable or --confirm-production");
  }

  const target = new URL(args.url);
  const databaseName = target.pathname.replace(/^\//, "");
  if (disposableMode) {
    if (!["127.0.0.1", "localhost", "::1"].includes(target.hostname)) {
      usageError("refusing to run against a non-loopback host");
    }
    if (!databaseName.startsWith("rehearsal")) {
      usageError("refusing to run against a database not named rehearsal*");
    }
  } else {
    if (["127.0.0.1", "localhost", "::1"].includes(target.hostname)) {
      usageError("--confirm-production refuses loopback targets");
    }
    if (databaseName.startsWith("rehearsal")) {
      usageError("--confirm-production refuses rehearsal* databases");
    }
    if (!/sslmode=(require|verify-ca|verify-full)/.test(target.search)) {
      usageError("--confirm-production requires an sslmode=require (or stronger) connection URL");
    }
    const caPath = args.sslRootCert;
    if (!caPath || !caPath.startsWith("/")) {
      usageError("--confirm-production requires an absolute --ssl-root-cert provider CA PEM path");
    }
    let caPem: string;
    try {
      caPem = readFileSync(caPath, "utf8");
    } catch {
      usageError("--ssl-root-cert must be a readable PEM certificate file");
    }
    if (!caPem.includes("-----BEGIN CERTIFICATE-----") || !caPem.includes("-----END CERTIFICATE-----")) {
      usageError("--ssl-root-cert must be a PEM certificate file");
    }
    // pg-connection-string reads sslrootcert into ssl.ca and verifies the
    // chain; a `ssl` PoolConfig object would be overridden by the string's
    // own ssl params, so the CA must travel in the URL itself.
    target.searchParams.set("sslmode", "verify-full");
    target.searchParams.set("sslrootcert", caPath);
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: target.toString(), max: 1 }),
  });

  const startedAt = new Date().toISOString();
  let report: BackfillReport;

  try {
    // One batch transaction per run: a thrown error rolls the whole apply
    // back, so an aborted run (exit 3) leaves no data behind.
    const result = await prisma.$transaction(async (tx) =>
      operation === "settings-consolidation"
        ? runSettingsConsolidation(tx, mode)
        : operation === "addon-usage-json-to-ledger"
          ? runAddonJsonToLedger(tx, mode)
          : runItemPhotoDirectToJoin(tx, mode),
    );

    const finishedAt = new Date().toISOString();
    const exitCode: BackfillReport["exitCode"] =
      result.mismatches.length > 0 ? 1 : result.quarantine.length > 0 ? 2 : 0;

    report = {
      operation,
      mode,
      cursor: null,
      startedAt,
      finishedAt,
      rowsScanned: result.rowsScanned,
      rowsChanged: result.rowsChanged,
      mismatches: result.mismatches,
      quarantine: result.quarantine,
      exitCode,
    };
  } catch (error) {
    // Aborted: exit 3. The batch transaction above rolls the whole apply
    // back, so an aborted run leaves no data behind.
    const finishedAt = new Date().toISOString();
    report = {
      operation,
      mode,
      cursor: null,
      startedAt,
      finishedAt,
      rowsScanned: 0,
      rowsChanged: 0,
      mismatches: [],
      quarantine: [],
      exitCode: 3,
    };
    console.error(`[backfill] aborted: ${error instanceof Error ? error.name : "UNKNOWN_ERROR"}`);
    const errorCode = (error as { code?: unknown } | undefined)?.code;
    if (typeof errorCode === "string") console.error(`[backfill] error code: ${errorCode}`);
    const errorMessage = (error as Error | undefined)?.message;
    if (errorMessage) console.error(errorMessage.split("\n").slice(0, 6).join("\n"));
    writeReport(report, args.reportFile);
    await prisma.$disconnect();
    process.exit(3);
  } finally {
    await prisma.$disconnect();
  }

  writeReport(report, args.reportFile);
  process.exit(report.exitCode);
};

const writeReport = (report: BackfillReport, reportFile?: string) => {
  const json = JSON.stringify(report, null, 2);
  if (reportFile) writeFileSync(reportFile, `${json}\n`);
  console.log(json);
};

// Run only as a CLI (skip under Vitest so planning helpers are importable).
if (!process.env.VITEST) {
  void main();
}
