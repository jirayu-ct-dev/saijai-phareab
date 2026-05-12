export type AdminCardTone = "neutral" | "primary" | "secondary" | "info" | "warning" | "success" | "error";

export const adminListCardBaseClass =
  "rounded-xl border p-3 transition-colors active:bg-elevated/90";

export const adminListCardToneClass: Record<AdminCardTone, string> = {
  neutral: "border-default/35 bg-elevated/70 hover:bg-elevated/80 dark:border-default/25 dark:bg-elevated/45 dark:hover:bg-elevated/60",
  primary: "border-default/35 bg-primary/10 hover:bg-primary/15 dark:border-default/25 dark:bg-elevated/45 dark:hover:bg-elevated/60",
  secondary: "border-default/35 bg-secondary/10 hover:bg-secondary/15 dark:border-default/25 dark:bg-elevated/45 dark:hover:bg-elevated/60",
  info: "border-default/35 bg-info/10 hover:bg-info/15 dark:border-default/25 dark:bg-elevated/45 dark:hover:bg-elevated/60",
  warning: "border-default/35 bg-warning/10 hover:bg-warning/15 dark:border-default/25 dark:bg-elevated/45 dark:hover:bg-elevated/60",
  success: "border-default/35 bg-success/10 hover:bg-success/15 dark:border-default/25 dark:bg-elevated/45 dark:hover:bg-elevated/60",
  error: "border-default/35 bg-error/10 hover:bg-error/15 dark:border-default/25 dark:bg-elevated/45 dark:hover:bg-elevated/60",
};

export const adminListCardClass = [adminListCardBaseClass, adminListCardToneClass.neutral].join(" ");

export const getAdminListCardClass = (tone: AdminCardTone = "neutral") =>
  [adminListCardBaseClass, adminListCardToneClass[tone]].join(" ");

export const adminMobileListCardClass =
  "overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-shadow duration-200 hover:shadow-md dark:border-slate-800 dark:bg-slate-900";

export const adminCatalogItemToneClasses = [
  "border-default/35 bg-primary/10 hover:bg-primary/15 dark:border-default/25 dark:bg-elevated/45 dark:hover:bg-elevated/60",
  "border-default/35 bg-info/10 hover:bg-info/15 dark:border-default/25 dark:bg-elevated/45 dark:hover:bg-elevated/60",
  "border-default/35 bg-warning/10 hover:bg-warning/15 dark:border-default/25 dark:bg-elevated/45 dark:hover:bg-elevated/60",
  "border-default/35 bg-success/10 hover:bg-success/15 dark:border-default/25 dark:bg-elevated/45 dark:hover:bg-elevated/60",
  "border-default/35 bg-secondary/10 hover:bg-secondary/15 dark:border-default/25 dark:bg-elevated/45 dark:hover:bg-elevated/60",
] as const;

export const getAdminCatalogItemToneClass = (key: string | null | undefined) => {
  const value = key?.trim() || "default";
  const hash = [...value].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return adminCatalogItemToneClasses[hash % adminCatalogItemToneClasses.length];
};

export const adminTableUi = {
  base: "table-fixed border-separate border-spacing-0",
  thead: "[&>tr]:bg-elevated/50 dark:[&>tr]:bg-elevated/35 [&>tr]:after:content-none",
  tbody: "[&>tr]:last:[&>td]:border-b-0 [&>tr:nth-child(odd)>td]:bg-primary/5 [&>tr:nth-child(even)>td]:bg-secondary/5 [&>tr:hover>td]:bg-info/10 dark:[&>tr:nth-child(odd)>td]:bg-elevated/25 dark:[&>tr:nth-child(even)>td]:bg-elevated/40 dark:[&>tr:hover>td]:bg-elevated/55",
  th: "border-y border-default/35 py-2 font-medium first:rounded-l-lg first:border-l last:rounded-r-lg last:border-r dark:border-default/25",
  td: "border-b border-default/35 transition-colors dark:border-default/25",
  separator: "h-0",
} as const;
