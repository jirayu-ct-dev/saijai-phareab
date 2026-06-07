import type { Session as AppSession, User as AppUser } from "~~/shared/types/auth";

export type SessionWithUser = (AppSession & { user?: AppUser }) | null;
export type SessionUser = AppUser;

export const fetchSessionStatus = async (): Promise<SessionWithUser> => {
  try {
    const headers = import.meta.server ? useRequestHeaders(["cookie"]) : undefined;
    return await $fetch<SessionWithUser>("/api/auth/session-status", { headers });
  } catch {
    return null;
  }
};
