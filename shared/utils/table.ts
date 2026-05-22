/**
 * Cycle through TanStack Table column sorting states (None -> Asc -> Desc -> None)
 * Useful when clicking on a column header element natively instead of via table config.
 * 
 * @param column - TanStack Table Column instance
 */
export const cycleColumnSorting = (column: any) => {
    const current = column.getIsSorted?.();
    if (!current) {
        column.toggleSorting?.(false); // Sort Ascending
    } else if (current === "asc") {
        column.toggleSorting?.(true);  // Sort Descending
    } else {
        column.clearSorting?.();       // Clear Sorting
    }
};
