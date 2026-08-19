const LINE_CLIENT_PATTERN = /\bLine\/|\bLIFF\b/i;
const LIFF_LAUNCH_QUERY_KEYS = ["liff.state", "liff.referrer"];
const LIFF_LAUNCH_HASH_KEYS = ["access_token", "context_token", "feature_token", "id_token"];

export function isLineClientUserAgent(userAgent: string) {
  return LINE_CLIENT_PATTERN.test(userAgent);
}

export function hasLiffLaunchMarker(inputUrl: string) {
  try {
    const parsed = new URL(inputUrl);
    const queryHasMarker = LIFF_LAUNCH_QUERY_KEYS.some((key) => parsed.searchParams.has(key));
    if (queryHasMarker) return true;

    const hash = new URLSearchParams(parsed.hash.replace(/^#/, ""));
    return LIFF_LAUNCH_HASH_KEYS.some((key) => hash.has(key));
  } catch {
    return false;
  }
}

export function isPotentialLiffLaunch(userAgent: string, inputUrl: string, persistedLaunchFlag = false) {
  return persistedLaunchFlag || isLineClientUserAgent(userAgent) || hasLiffLaunchMarker(inputUrl);
}
