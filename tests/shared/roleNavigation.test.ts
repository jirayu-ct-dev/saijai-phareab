import { describe, expect, it } from "vitest";
import { getRoleHomeLabel, getRoleHomeRoute } from "../../app/utils/roleNavigation";

describe("role navigation", () => {
  it.each([
    ["ADMIN", "/admin", "หน้าหลักแอดมิน"],
    ["EMPLOYEE", "/admin/employee-dashboard", "หน้าหลักพนักงาน"],
    ["USER", "/me", "หน้าหลักลูกค้า"],
  ] as const)("keeps %s on its own role home", (role, route, label) => {
    expect(getRoleHomeRoute(role)).toBe(route);
    expect(getRoleHomeLabel(role)).toBe(label);
  });

  it("uses the customer home as the safe fallback", () => {
    expect(getRoleHomeRoute()).toBe("/me");
    expect(getRoleHomeLabel()).toBe("หน้าหลักลูกค้า");
  });
});
