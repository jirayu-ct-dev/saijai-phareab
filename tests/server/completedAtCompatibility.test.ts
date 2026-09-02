import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("DB-04 completedAt compatibility writers", () => {
  it("stamps create, status PATCH, and full edit PUT through the shared completion rule", () => {
    expect(source("server/api/admin/service-orders/index.post.ts")).toContain("resolveServiceOrderCompletedAt({");
    expect(source("server/api/admin/service-orders/[id]/status.patch.ts")).toContain("resolveServiceOrderCompletedAt({");
    expect(source("server/api/admin/service-orders/[id].put.ts")).toContain("resolveServiceOrderCompletedAt({");
  });

  it("prevents the full edit endpoint from bypassing the service-order state machine", () => {
    const putSource = source("server/api/admin/service-orders/[id].put.ts");

    expect(putSource).toContain("canTransitionServiceOrderStatus(existing.status, serviceOrderStatus)");
    expect(putSource).toContain("ไม่สามารถข้ามสถานะรายการรับผ้าได้");
  });

  it("uses an optimistic status guard for both transition-capable update paths", () => {
    for (const path of [
      "server/api/admin/service-orders/[id]/status.patch.ts",
      "server/api/admin/service-orders/[id].put.ts",
    ]) {
      const contents = source(path);
      expect(contents, path).toMatch(/serviceOrder\.updateMany\([\s\S]*status:\s*existing\.status/);
      expect(contents, path).toContain("SERVICE_ORDER_STATUS_CONFLICT");
    }
  });
});
