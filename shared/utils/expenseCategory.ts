/**
 * Normalizes an expense category name for unique constraint and deduplication.
 * Trims whitespace, collapses internal consecutive whitespace, and converts to lowercase.
 */
export function normalizeCategoryName(name: string): string {
  return (name ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
}
