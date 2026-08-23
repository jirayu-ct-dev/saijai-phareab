import type { BetterAuthOptions } from "better-auth";

/**
 * User fields beyond the core Better Auth schema.
 *
 * Privileged and derived fields must keep `input: false` so they can never be
 * set through /api/auth endpoints (sign-up, update-user). Role/status are
 * managed exclusively by the admin APIs, and phone number changes go through
 * PUT /api/me/profile, which derives normalizedPhoneNumber. Removing
 * `input: false` re-opens a privilege-escalation hole guarded by
 * tests/server/authPrivilegeEscalation.test.ts.
 */
export const authUserAdditionalFields: NonNullable<
  BetterAuthOptions["user"]
>["additionalFields"] = {
  role: {
    type: "string",
    required: true,
    input: false,
    defaultValue: "USER",
  },
  phoneNumber: {
    type: "string",
    required: false,
    input: false,
  },
  normalizedPhoneNumber: {
    type: "string",
    required: false,
    input: false,
  },
  isActive: {
    type: "boolean",
    required: false,
    input: false,
  },
  deletedAt: {
    type: "date",
    required: false,
    input: false,
  },
  deletedById: {
    type: "string",
    required: false,
    input: false,
  },
};
