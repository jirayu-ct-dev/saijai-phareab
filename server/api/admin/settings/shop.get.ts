import { requireRole } from "~~/server/utils/auth";
import { getShopIdentity } from "~~/server/utils/appSetting";

export default defineEventHandler(async (event) => {
  requireRole(event, ["ADMIN", "EMPLOYEE"]);

  // DB-06 read cutover: identity resolves from AppSetting with per-field
  // legacy fallback and soak comparison (plan Phase 5.1).
  return getShopIdentity();
});
