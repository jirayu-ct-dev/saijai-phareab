import type { Session as AppSession, User as AppUser } from "~~/shared/types/auth";

export type SessionWithUser = (AppSession & { user?: AppUser }) | null;
export type SessionUser = AppUser;

type FetchSessionStatusOptions = {
  force?: boolean;
  maxAgeMs?: number;
};

const SESSION_STATUS_CACHE_MS = 60_000;

let cachedSession: SessionWithUser | undefined;
let cachedAt = 0;
let pendingSession: Promise<SessionWithUser> | null = null;

export const clearSessionStatusCache = () => {
  cachedSession = undefined;
  cachedAt = 0;
  pendingSession = null;
};

export const fetchSessionStatus = async (options: FetchSessionStatusOptions = {}): Promise<SessionWithUser> => {
  try {
    const maxAgeMs = options.maxAgeMs ?? SESSION_STATUS_CACHE_MS;

    if (import.meta.client && !options.force) {
      const isCacheFresh = cachedSession !== undefined && Date.now() - cachedAt < maxAgeMs;
      if (isCacheFresh) return cachedSession ?? null;
      if (pendingSession) return pendingSession;
    }

    const headers = import.meta.server ? useRequestHeaders(["cookie"]) : undefined;
    const request = $fetch<SessionWithUser>("/api/auth/session-status", { headers });

    if (import.meta.client) {
      pendingSession = request;
    }

    const session = await request;

    if (import.meta.client) {
      cachedSession = session;
      cachedAt = Date.now();
    }

    return session;
  } catch {
    if (import.meta.client) clearSessionStatusCache();
    return null;
  } finally {
    if (import.meta.client) {
      pendingSession = null;
    }
  }
};
