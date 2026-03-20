import type { Role } from "~~/shared/types/enums";

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
  userPackage: {
    id: string;
    creditRemain: number | null;
    endDate: string | Date | null;
    package: {
      id: string;
      name: string;
    };
  } | null;
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

  const { data: users, status, refresh } = useFetch<AdminUser[]>("/api/admin/users", {
    default: () => [],
  });

  const isLoading = computed(() => status.value === "pending");

  const createUser = async (body: CreateAdminUserBody): Promise<boolean> => {
    try {
      await $fetch("/api/admin/users", { method: "POST", body });
      await refresh();
      notify.created("User");
      return true;
    } catch (error: unknown) {
      notify.error(getErrorMessage(error, "Unable to create user"));
      return false;
    }
  };

  const updateUser = async (id: string, body: UpdateAdminUserBody): Promise<boolean> => {
    try {
      await $fetch(`/api/admin/users/${id}`, { method: "PUT", body });
      await refresh();
      notify.updated("User");
      return true;
    } catch (error: unknown) {
      notify.error(getErrorMessage(error, "Unable to update user"));
      return false;
    }
  };

  const deleteUser = async (id: string): Promise<boolean> => {
    try {
      await $fetch(`/api/admin/users/${id}`, { method: "DELETE" });
      await refresh();
      notify.deleted("User");
      return true;
    } catch (error: unknown) {
      notify.error(getErrorMessage(error, "Unable to delete user"));
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
