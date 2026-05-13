export type AdminCardTone = "neutral" | "primary" | "secondary" | "info" | "warning" | "success" | "error";

/* ------------------------------------------------------------------ */
/* Refined Shopee-style admin tokens.                                 */
/* Restrained radius (rounded-md), softer borders,                    */
/* lighter shadows. Keeps blue/cyan brand identity.                   */
/* ------------------------------------------------------------------ */

const cardShadow =
  "shadow-[0_1px_2px_rgb(15_23_42/0.04),0_6px_18px_-10px_rgb(15_23_42/0.08)] hover:shadow-[0_1px_3px_rgb(15_23_42/0.05),0_10px_24px_-12px_rgb(15_23_42/0.10)] dark:shadow-[0_1px_2px_rgb(0_0_0/0.16),0_8px_22px_-12px_rgb(0_0_0/0.26)] dark:hover:shadow-[0_1px_3px_rgb(0_0_0/0.22),0_12px_28px_-12px_rgb(0_0_0/0.32)]";

const surfaceShadow =
  "shadow-[0_1px_2px_rgb(15_23_42/0.04),0_6px_18px_-10px_rgb(15_23_42/0.08)] dark:shadow-[0_1px_2px_rgb(0_0_0/0.16),0_8px_22px_-12px_rgb(0_0_0/0.26)]";

const cardBorder = "border-default/30 dark:border-default/20";
const cardSurface = "bg-default dark:bg-elevated/55";
const cardSurfaceHover = "hover:border-default/45 hover:bg-default dark:hover:bg-elevated/70";

/* List card — used in admin list rows (mobile + desktop fallback) */
export const adminListCardBaseClass = [
  "rounded-md border p-2 transition-[background-color,border-color,box-shadow] duration-200",
  cardShadow,
].join(" ");

export const adminListCardToneClass: Record<AdminCardTone, string> = {
  neutral: `${cardBorder} ${cardSurface} ${cardSurfaceHover}`,
  primary: `border-primary/20 bg-primary/5 hover:border-primary/35 hover:bg-primary/[0.08] dark:border-primary/25 dark:bg-elevated/55 dark:hover:bg-elevated/70`,
  secondary: `border-secondary/20 bg-secondary/[0.05] hover:border-secondary/35 hover:bg-secondary/[0.08] dark:border-secondary/25 dark:bg-elevated/55 dark:hover:bg-elevated/70`,
  info: `border-info/20 bg-info/5 hover:border-info/35 hover:bg-info/[0.08] dark:border-info/25 dark:bg-elevated/55 dark:hover:bg-elevated/70`,
  warning: `border-warning/25 bg-warning/[0.06] hover:border-warning/40 hover:bg-warning/[0.09] dark:border-warning/25 dark:bg-elevated/55 dark:hover:bg-elevated/70`,
  success: `border-success/20 bg-success/[0.05] hover:border-success/35 hover:bg-success/[0.08] dark:border-success/25 dark:bg-elevated/55 dark:hover:bg-elevated/70`,
  error: `border-error/20 bg-error/[0.05] hover:border-error/35 hover:bg-error/[0.08] dark:border-error/25 dark:bg-elevated/55 dark:hover:bg-elevated/70`,
};

export const adminListCardClass = [adminListCardBaseClass, adminListCardToneClass.neutral].join(" ");

export const getAdminListCardClass = (tone: AdminCardTone = "neutral") =>
  [adminListCardBaseClass, adminListCardToneClass[tone]].join(" ");

/* Mobile list card */
export const adminMobileListCardClass = [
  "overflow-hidden rounded-md border transition-[background-color,border-color,box-shadow] duration-200",
  cardBorder,
  cardSurface,
  cardSurfaceHover,
  cardShadow,
].join(" ");

/* Page-level paddings & gaps — follows the approved admin dashboard rhythm */
export const adminDashboardBodyClass =
  "admin-dashboard flex flex-col gap-4 p-2 sm:gap-6 sm:p-6";

export const adminDashboardCardClass = [
  "admin-dashboard-card rounded-md border p-4",
  cardBorder,
  cardSurface,
  surfaceShadow,
].join(" ");

export const adminFilterBarClass = [
  "admin-dashboard-card rounded-md border p-2",
  cardBorder,
  cardSurface,
  surfaceShadow,
].join(" ");

/* Section "surface" — transparent spacing-only container */
export const adminSurfaceSectionClass =
  "flex flex-col gap-2";

/* Metric card */
export const adminMetricCardClass = [
  "min-w-0 rounded-md border transition-[background-color,border-color,box-shadow] duration-200",
  cardBorder,
  cardSurface,
  cardSurfaceHover,
  cardShadow,
].join(" ");

/* Catalog (POS) card base — restrained product-card feel */
export const adminCatalogCardBaseClass = [
  "group relative flex cursor-pointer flex-col justify-between gap-2 rounded-md border p-2 text-left",
  "transition-[background-color,border-color,box-shadow] duration-200",
  cardShadow,
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
].join(" ");

/* Inset surface — transparent spacing container */
export const adminInsetSurfaceClass = "flex flex-col gap-3";

/* Empty state */
export const adminEmptyStateClass = [
  "flex flex-col items-center justify-center rounded-md border border-dashed px-3 py-5 text-center text-muted",
  "border-default/30 bg-default/55 dark:border-default/20 dark:bg-elevated/30",
].join(" ");

/* Catalog tone palette — soft pastel tints, blue/cyan-forward (subtle) */
export const adminCatalogItemToneClasses = [
  "border-sky-200/55 bg-default hover:border-sky-300/70 hover:bg-sky-50/60 dark:border-sky-900/30 dark:bg-elevated/55 dark:hover:bg-elevated/70",
  "border-cyan-200/55 bg-default hover:border-cyan-300/70 hover:bg-cyan-50/60 dark:border-cyan-900/30 dark:bg-elevated/55 dark:hover:bg-elevated/70",
  "border-indigo-200/55 bg-default hover:border-indigo-300/70 hover:bg-indigo-50/60 dark:border-indigo-900/30 dark:bg-elevated/55 dark:hover:bg-elevated/70",
  "border-teal-200/55 bg-default hover:border-teal-300/70 hover:bg-teal-50/60 dark:border-teal-900/30 dark:bg-elevated/55 dark:hover:bg-elevated/70",
  "border-blue-200/55 bg-default hover:border-blue-300/70 hover:bg-blue-50/60 dark:border-blue-900/30 dark:bg-elevated/55 dark:hover:bg-elevated/70",
] as const;

export const getAdminCatalogItemToneClass = (key: string | null | undefined) => {
  const value = key?.trim() || "default";
  const hash = [...value].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return adminCatalogItemToneClasses[hash % adminCatalogItemToneClasses.length];
};

/* Table UI — clean, professional, white headers, low-contrast separators */
export const adminTableUi = {
  root: "relative overflow-x-auto",
  base: "table-fixed border-separate border-spacing-0",
  thead:
    "sticky top-0 z-1 [&>tr]:bg-muted dark:[&>tr]:bg-elevated/60 [&>tr]:after:content-none",
  tbody:
    "[&>tr]:last:[&>td]:border-b-0 [&>tr>td:nth-child(even)]:bg-elevated/20 dark:[&>tr>td:nth-child(even)]:bg-elevated/25 [&>tr:hover>td]:bg-primary/5 dark:[&>tr:hover>td]:bg-elevated/45",
  th: "border-b border-default bg-muted dark:bg-elevated/60 py-2.5 font-semibold text-toned text-xs uppercase tracking-wide dark:border-default/30",
  td: "border-b border-default py-2.5 transition-colors dark:border-default/25",
  separator: "h-0",
} as const;
