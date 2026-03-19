type MemberState = {
  userId: string | null;
  isMember: boolean | null;
  checkedAt: number | null;
};

const MEMBER_STATUS_TTL_MS = 60_000;
const ALLOWED_ROLES = ["USER", "EMPLOYEE", "ADMIN"];
const PRIVILEGED_ROLES = ["EMPLOYEE", "ADMIN"];

export default defineNuxtRouteMiddleware(async () => {
  const { user } = useUser();

  if (!user.value) {
    return navigateTo("/auth/login");
  }

  if (!ALLOWED_ROLES.includes(user.value.role)) {
    return navigateTo("/");
  }

  // EMPLOYEE / ADMIN can access member pages without package check.
  if (PRIVILEGED_ROLES.includes(user.value.role)) {
    return;
  }

  // USER must have an active userPackage to be considered a member.
  const memberState = useState<MemberState>("member-status", () => ({
    userId: null,
    isMember: null,
    checkedAt: null,
  }));

  if (memberState.value.userId !== user.value.id) {
    memberState.value.userId = user.value.id;
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

