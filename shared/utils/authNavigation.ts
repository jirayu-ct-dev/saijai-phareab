export const getSafeInternalRedirect = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  if (!value.startsWith("/") || value.startsWith("//")) return null;

  try {
    const url = new URL(value, "https://local.invalid");
    if (url.origin !== "https://local.invalid") return null;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
};
