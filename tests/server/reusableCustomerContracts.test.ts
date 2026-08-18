import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("reusable customer integration contracts", () => {
  it("disables implicit OAuth linking while keeping explicit LINE linking available", () => {
    expect(source("app/utils/auth.ts")).toMatch(/disableImplicitLinking:\s*true/);
    expect(source("app/components/account/LineLinkSection.vue")).toContain("authClient.linkSocial");
  });

  it("does not run LIFF auto-login before the public claim page", () => {
    const middleware = source("app/middleware/auth.global.ts");
    expect(middleware).toContain('to.path === "/auth/claim-customer"');
    expect(middleware).toMatch(/!shouldSkipLiffAutoLogin[\s\S]*ensureLiffSession/);
  });

  it.each([
    "server/api/admin/exports/addon-usages.get.ts",
    "server/api/admin/exports/members.get.ts",
    "server/api/admin/exports/orders.get.ts",
    "server/api/admin/exports/sales.get.ts",
    "server/api/admin/members/index.get.ts",
  ])("masks internal customer email in %s", (path) => {
    expect(source(path)).toContain("isInternalCustomerEmail");
  });

  it("keeps deterministic demo users searchable by normalized phone", () => {
    expect(source("prisma/seed-full.ts")).toContain("normalizedPhoneNumber: normalizeThaiPhoneNumber(u.phone)");
  });

  it("does not let an outstanding customer claim token become staff credentials", () => {
    expect(source("server/api/admin/users/[id].put.ts")).toMatch(/customerAccountStatus === "OFFLINE"[\s\S]*payload\.role/);
    expect(source("server/api/admin/employees/promote.post.ts")).toMatch(/customerAccountStatus === "OFFLINE"/);
  });
});
