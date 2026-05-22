import type { Role } from "~~/shared/types/enums";

export type AdminUserMemberEntitlement = {
  id: string;
  creditRemaining: number | null;
  endAt: string | Date | null;
  product: {
    id: string;
    name: string;
  };
};

export type AdminUser = {
  id: string;
  email: string;
  name: string | null;
  image?: string | null;
  lineUserId?: string | null;
  role: Role;
  phoneNumber: string | null;
  emailVerified: boolean;
  createdAt: string | Date;
  updatedAt: string | Date;
  memberEntitlement: AdminUserMemberEntitlement | null;
  memberEntitlements: AdminUserMemberEntitlement[];
};

export type CreateAdminUserBody = {
  email: string;
  password?: string;
  name?: string | null;
  phoneNumber?: string | null;
  role?: Role;
  emailVerified?: boolean;
};

export type UpdateAdminUserBody = Partial<CreateAdminUserBody>;

export const useAdminUsers = () => {
  const notify = useNotify();

  const getErrorMessage = (error: unknown, fallback: string) => {
    if (error && typeof error === "object" && "data" in error) {
      const data = (error as { data?: { statusMessage?: string } }).data;
      if (data?.statusMessage) return data.statusMessage;
    }

    return fallback;
  };

  const { data: users, pending, status, refresh } = useFetch<AdminUser[]>("/api/admin/users", {
    key: "admin-users",
    default: () => [],
    server: false,
    lazy: true,
  });

  const isLoading = computed(() => pending.value || status.value === "idle");

  const createUser = async (body: CreateAdminUserBody): Promise<boolean> => {
    try {
      await $fetch("/api/admin/users", { method: "POST", body });
      await refresh();
      notify.created("ผู้ใช้งาน");
      return true;
    } catch (error: unknown) {
      notify.error(getErrorMessage(error, "ไม่สามารถสร้างผู้ใช้งานได้"));
      return false;
    }
  };

  const updateUser = async (id: string, body: UpdateAdminUserBody): Promise<boolean> => {
    try {
      const response = await $fetch<{ sessionsRevoked?: number }>(`/api/admin/users/${id}`, {
        method: "PUT",
        body,
      });

      await refresh();
      notify.updated("ผู้ใช้งาน");

      if ((response.sessionsRevoked ?? 0) > 0) {
        notify.info("มีการเปลี่ยนสิทธิ์ผู้ใช้งาน ระบบได้ยกเลิกเซสชันเดิมแล้ว");
      }

      return true;
    } catch (error: unknown) {
      notify.error(getErrorMessage(error, "ไม่สามารถอัปเดตผู้ใช้งานได้"));
      return false;
    }
  };

  const deleteUser = async (id: string): Promise<boolean> => {
    try {
      await $fetch(`/api/admin/users/${id}`, { method: "DELETE" });
      await refresh();
      notify.deleted("ผู้ใช้งาน");
      return true;
    } catch (error: unknown) {
      notify.error(getErrorMessage(error, "ไม่สามารถลบผู้ใช้งานได้"));
      return false;
    }
  };

  return {
    users,
    isLoading,
    refresh,
    createUser,
    updateUser,
    deleteUser,
  };
};
