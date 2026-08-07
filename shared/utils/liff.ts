const LINE_CLIENT_PATTERN = /\bLine\/|\bLIFF\b/i;
const LIFF_LAUNCH_QUERY_KEYS = ["liff.state", "liff.referrer"];
const LIFF_LAUNCH_HASH_KEYS = ["access_token", "context_token", "feature_token", "id_token"];

export const isLineClientUserAgent = (userAgent: string) => LINE_CLIENT_PATTERN.test(userAgent);

export const hasLiffLaunchMarker = (url: string) => {
  try {
    const parsed = new URL(url);
    const queryHasMarker = LIFF_LAUNCH_QUERY_KEYS.some((key) => parsed.searchParams.has(key));
    if (queryHasMarker) return true;

    const hash = new URLSearchParams(parsed.hash.replace(/^#/, ""));
    return LIFF_LAUNCH_HASH_KEYS.some((key) => hash.has(key));
  } catch {
    return false;
  }
};

export const isPotentialLiffLaunch = (userAgent: string, url: string, persistedLaunch = false) =>
  persistedLaunch || isLineClientUserAgent(userAgent) || hasLiffLaunchMarker(url);
