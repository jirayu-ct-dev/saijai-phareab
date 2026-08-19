/**
 * Cycle through TanStack Table column sorting states (None -> Asc -> Desc -> None)
 * Useful when clicking on a column header element natively instead of via table config.
 * 
 * @param column - TanStack Table Column instance
 */
type SortableColumn = {
    getIsSorted?: () => false | "asc" | "desc";
    toggleSorting?: (descending: boolean) => void;
    clearSorting?: () => void;
};

export type SortDirection = "asc" | "desc" | null;
export type SortState<TColumn extends string = string> = {
    column: TColumn | null;
    direction: SortDirection;
};

export const cycleColumnSorting = (column: SortableColumn) => {
    const current = column.getIsSorted?.();
    if (!current) {
        column.toggleSorting?.(false); // Sort Ascending
    } else if (current === "asc") {
        column.toggleSorting?.(true);  // Sort Descending
    } else {
        column.clearSorting?.();       // Clear Sorting
    }
};

export const columnSortIcon = (direction: false | SortDirection | undefined) => {
    if (direction === "asc") return "i-lucide-arrow-up";
    if (direction === "desc") return "i-lucide-arrow-down";
    return "i-lucide-arrow-up-down";
};

export const cycleSortState = <TColumn extends string>(
    current: SortState<TColumn>,
    column: TColumn,
): SortState<TColumn> => {
    if (current.column !== column || current.direction === null) return { column, direction: "asc" };
    if (current.direction === "asc") return { column, direction: "desc" };
    return { column: null, direction: null };
};
