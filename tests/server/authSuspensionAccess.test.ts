import { describe, expect, it } from "vitest";

// server/utils/auth relies on Nitro's auto-imported createError and
// instantiates the Prisma client at import time. Provide minimal stand-ins so
// the guards can be exercised directly in the Node test environment.
process.env.DATABASE_URL ??= "postgresql://postgres:postgres@127.0.0.1:5432/test";
(globalThis as { createError?: unknown }).createError ??= (init: {
  statusCode?: number;
  statusMessage?: string;
}) => {
  const error = new Error(init.statusMessage ?? "Error") as Error & { statusCode?: number };
  error.statusCode = init.statusCode ?? 500;
  return error;
};

const { requireUser, requireRole } = await import("../../server/utils/auth");

type TestUser = {
  id: string;
  role: "USER" | "EMPLOYEE" | "ADMIN";
  isActive: boolean;
  deletedAt: Date | null;
};

const activeUser = (role: TestUser["role"]): TestUser => ({
  id: "user-1",
  role,
  isActive: true,
  deletedAt: null,
});

const suspendedUser = (role: TestUser["role"]): TestUser => ({
  ...activeUser(role),
  isActive: false,
});

const eventWith = (user: TestUser | null) =>
  ({ context: { user } }) as Parameters<typeof requireUser>[0];

const statusCodeOf = (error: unknown) =>
  (error as { statusCode?: number }).statusCode;

describe("requireUser", () => {
  it("returns the authenticated active user", () => {
    const user = activeUser("USER");
    expect(requireUser(eventWith(user))).toBe(user);
  });

  it("still returns a suspended user so /api/me keeps working for them", () => {
    const user = suspendedUser("EMPLOYEE");
    expect(requireUser(eventWith(user))).toBe(user);
  });

  it("rejects requests without a session user", () => {
    expect(() => requireUser(eventWith(null))).toThrow();
    try {
      requireUser(eventWith(null));
    } catch (error) {
      expect(statusCodeOf(error)).toBe(401);
    }
  });

  it("rejects deleted users", () => {
    const user = { ...activeUser("USER"), deletedAt: new Date() };
    expect(() => requireUser(eventWith(user))).toThrow();
    try {
      requireUser(eventWith(user));
    } catch (error) {
      expect(statusCodeOf(error)).toBe(403);
    }
  });
});

describe("requireRole", () => {
  it("returns an active user whose role is allowed", () => {
    const user = activeUser("EMPLOYEE");
    expect(requireRole(eventWith(user), ["EMPLOYEE", "ADMIN"])).toBe(user);
  });

  it("blocks a suspended staff member even when the role would match", () => {
    expect(() => requireRole(eventWith(suspendedUser("EMPLOYEE")), ["EMPLOYEE", "ADMIN"])).toThrow();
    try {
      requireRole(eventWith(suspendedUser("EMPLOYEE")), ["EMPLOYEE", "ADMIN"]);
    } catch (error) {
      expect(statusCodeOf(error)).toBe(403);
    }
  });

  it("blocks a suspended admin from admin-role endpoints", () => {
    expect(() => requireRole(eventWith(suspendedUser("ADMIN")), ["ADMIN"])).toThrow();
  });

  it("blocks an active user whose role is not allowed", () => {
    expect(() => requireRole(eventWith(activeUser("EMPLOYEE")), ["ADMIN"])).toThrow();
    try {
      requireRole(eventWith(activeUser("EMPLOYEE")), ["ADMIN"]);
    } catch (error) {
      expect(statusCodeOf(error)).toBe(403);
    }
  });
});
