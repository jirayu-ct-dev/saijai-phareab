const LIFF_TOKEN_HASH_KEYS = ["access_token", "context_token", "feature_token", "id_token"];

/**
 * Remove LIFF tokens (access/id/context/feature) from the URL hash. Call only
 * after liff.init() has consumed them; the tokens would otherwise linger in
 * the address bar and leak through shared links or referrers. Returns true
 * when the URL was rewritten.
 */
export function stripLiffTokensFromUrl(): boolean {
  if (!window.location.hash) return false;
  const hash = window.location.hash.replace(/^#/, "");
  if (!hash) return false;
  const params = new URLSearchParams(hash);
  if (!LIFF_TOKEN_HASH_KEYS.some((key) => params.has(key))) return false;
  for (const key of LIFF_TOKEN_HASH_KEYS) params.delete(key);
  const remaining = params.toString();
  const nextUrl = `${window.location.pathname}${window.location.search}${remaining ? `#${remaining}` : ""}`;
  window.history.replaceState(window.history.state, "", nextUrl);
  return true;
}
