import { authClient } from "~~/app/utils/auth-client";
import type { Role } from "~~/shared/types/enums";

type MemberState = {
  userId: string | null;
  isMember: boolean | null;
  checkedAt: number | null;
};

type SessionUserWithRole = {
  id?: string;
  role?: Role;
};

const MEMBER_STATUS_TTL_MS = 60_000;
const ALLOWED_ROLES: Role[] = ["USER", "EMPLOYEE", "ADMIN"];
const PRIVILEGED_ROLES: Role[] = ["EMPLOYEE", "ADMIN"];

export default defineNuxtRouteMiddleware(async () => {
  const authSession = useState<unknown | null>("auth:session", () => null);
  const { data: session } = await authClient.useSession(useFetch);

  if (!session.value?.user) {
    authSession.value = null;
    return navigateTo("/auth/login");
  }

  authSession.value = session.value;
  const user = session.value.user as SessionUserWithRole;
  if (!user.id || !user.role) {
    return navigateTo("/auth/login");
  }

  if (!ALLOWED_ROLES.includes(user.role)) {
    return navigateTo("/");
  }

  // EMPLOYEE / ADMIN can access member pages without package check.
  if (PRIVILEGED_ROLES.includes(user.role)) {
    return;
  }

  // USER must have an active member entitlement to be considered a member.
  const memberState = useState<MemberState>("member-status", () => ({
    userId: null,
    isMember: null,
    checkedAt: null,
  }));

  if (memberState.value.userId !== user.id) {
    memberState.value.userId = user.id;
    memberState.value.isMember = null;
    memberState.value.checkedAt = null;
  }

  const isCacheFresh =
    memberState.value.checkedAt !== null &&
    Date.now() - memberState.value.checkedAt < MEMBER_STATUS_TTL_MS;

  if (memberState.value.isMember === null || !isCacheFresh) {
    try {
      const response = await $fetch<{ isMember: boolean }>("/api/auth/member-status");
      memberState.value.isMember = response.isMember;
      memberState.value.checkedAt = Date.now();
    } catch (error: unknown) {
      const status =
        typeof error === "object" && error !== null && "status" in error
          ? (error as { status?: number }).status
          : undefined;
      memberState.value.checkedAt = null;
      if (status === 401) {
        return navigateTo("/auth/login");
      }
      return navigateTo("/");
    }
  }

  if (!memberState.value.isMember) {
    return navigateTo("/");
  }
});
