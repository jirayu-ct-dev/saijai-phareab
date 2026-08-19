import { describe, expect, it, vi } from "vitest";
import { columnSortIcon, cycleColumnSorting, cycleSortState } from "../../shared/utils/table";

describe("three-state table sorting", () => {
  it("cycles default to ascending, descending, then the original default", () => {
    const ascending = cycleSortState({ column: null, direction: null }, "price");
    const descending = cycleSortState(ascending, "price");
    const original = cycleSortState(descending, "price");

    expect(ascending).toEqual({ column: "price", direction: "asc" });
    expect(descending).toEqual({ column: "price", direction: "desc" });
    expect(original).toEqual({ column: null, direction: null });
  });

  it("starts ascending when switching to another sortable column", () => {
    expect(cycleSortState({ column: "price", direction: "desc" }, "createdAt"))
      .toEqual({ column: "createdAt", direction: "asc" });
  });

  it("uses an icon that matches every state", () => {
    expect(columnSortIcon(null)).toBe("i-lucide-arrow-up-down");
    expect(columnSortIcon("asc")).toBe("i-lucide-arrow-up");
    expect(columnSortIcon("desc")).toBe("i-lucide-arrow-down");
  });

  it.each([
    [false, false, "toggle"],
    ["asc", true, "toggle"],
    ["desc", null, "clear"],
  ] as const)("moves a TanStack column from %s to the next state", (current, descending, expectedAction) => {
    const toggleSorting = vi.fn();
    const clearSorting = vi.fn();

    cycleColumnSorting({
      getIsSorted: () => current,
      toggleSorting,
      clearSorting,
    });

    if (expectedAction === "clear") {
      expect(clearSorting).toHaveBeenCalledOnce();
      expect(toggleSorting).not.toHaveBeenCalled();
      return;
    }

    expect(toggleSorting).toHaveBeenCalledWith(descending);
    expect(clearSorting).not.toHaveBeenCalled();
  });
});
