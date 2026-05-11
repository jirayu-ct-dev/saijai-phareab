export type AdminCardTone = "neutral" | "primary" | "secondary" | "info" | "warning" | "success" | "error";

export const adminListCardBaseClass =
  "rounded-xl border p-3 transition-colors active:bg-elevated/90";

export const adminListCardToneClass: Record<AdminCardTone, string> = {
  neutral: "border-default/40 bg-elevated/70 hover:bg-elevated/80",
  primary: "border-default/40 bg-primary/10 hover:bg-primary/15",
  secondary: "border-default/40 bg-secondary/10 hover:bg-secondary/15",
  info: "border-default/40 bg-info/10 hover:bg-info/15",
  warning: "border-default/40 bg-warning/10 hover:bg-warning/15",
  success: "border-default/40 bg-success/10 hover:bg-success/15",
  error: "border-default/40 bg-error/10 hover:bg-error/15",
};

export const adminListCardClass = [adminListCardBaseClass, adminListCardToneClass.neutral].join(" ");

export const getAdminListCardClass = (tone: AdminCardTone = "neutral") =>
  [adminListCardBaseClass, adminListCardToneClass[tone]].join(" ");

export const adminCatalogItemToneClasses = [
  "border-default/30 bg-primary/10 hover:bg-primary/15",
  "border-default/30 bg-info/10 hover:bg-info/15",
  "border-default/30 bg-warning/10 hover:bg-warning/15",
  "border-default/30 bg-success/10 hover:bg-success/15",
  "border-default/30 bg-secondary/10 hover:bg-secondary/15",
] as const;

export const getAdminCatalogItemToneClass = (key: string | null | undefined) => {
  const value = key?.trim() || "default";
  const hash = [...value].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return adminCatalogItemToneClasses[hash % adminCatalogItemToneClasses.length];
};

export const adminTableUi = {
  base: "table-fixed border-separate border-spacing-0",
  thead: "[&>tr]:bg-elevated/50 [&>tr]:after:content-none",
  tbody: "[&>tr]:last:[&>td]:border-b-0 [&>tr:nth-child(odd)>td]:bg-primary/5 [&>tr:nth-child(even)>td]:bg-secondary/5 [&>tr:hover>td]:bg-info/10",
  th: "border-y border-default/40 py-2 font-medium first:rounded-l-lg first:border-l last:rounded-r-lg last:border-r",
  td: "border-b border-default/40 transition-colors",
  separator: "h-0",
} as const;
