import type { Role } from "~~/shared/types/enums";

export const getRoleHomeRoute = (role?: Role): string => {
  if (role === "ADMIN") return "/admin";
  if (role === "EMPLOYEE") return "/admin/employee-dashboard";
  return "/me";
};

export const getRoleHomeLabel = (role?: Role): string => {
  if (role === "ADMIN") return "หน้าหลักแอดมิน";
  if (role === "EMPLOYEE") return "หน้าหลักพนักงาน";
  return "หน้าหลักลูกค้า";
};
