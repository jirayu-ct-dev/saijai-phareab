import { describe, expect, it } from "vitest";
import { betterAuth } from "better-auth";
import { authUserAdditionalFields } from "../../app/utils/auth-user-fields";

type AnyRecord = Record<string, any>;

/**
 * Minimal in-memory adapter with just enough surface for the
 * sign-up / sign-in / update-user flows. The stored records let the test
 * assert exactly what Better Auth persists.
 */
function createMemoryDb() {
  const tables = new Map<string, Map<string, AnyRecord>>();
  const table = (model: string) => {
    if (!tables.has(model)) tables.set(model, new Map());
    return tables.get(model)!;
  };
  const matches = (record: AnyRecord, where: AnyRecord[]) =>
    where.every((clause) => {
      switch (clause.operator) {
        case "ne":
          return record[clause.field] !== clause.value;
        case "in":
          return Array.isArray(clause.value) && clause.value.includes(record[clause.field]);
        default:
          return record[clause.field] === clause.value;
      }
    });
  let seq = 0;
  return {
    tables,
    adapter: {
      create: async ({ model, data }: { model: string; data: AnyRecord }) => {
        const id = typeof data.id === "string" ? data.id : `${model}-${++seq}`;
        const record = { ...data, id };
        table(model).set(id, record);
        return { ...record };
      },
      findOne: async ({ model, where, join }: { model: string; where: AnyRecord[]; join?: AnyRecord }) => {
        for (const record of table(model).values()) {
          if (!matches(record, where)) continue;
          const result: AnyRecord = { ...record };
          if (join?.user && model === "session") {
            const user = record.userId ? table("user").get(String(record.userId)) : null;
            if (!user) return null;
            result.user = { ...user };
          }
          return result;
        }
        return null;
      },
      findMany: async ({ model, where }: { model: string; where?: AnyRecord[] }) =>
        [...table(model).values()].filter((record) => !where || matches(record, where)).map((record) => ({ ...record })),
      update: async ({ model, where, update }: { model: string; where: AnyRecord[]; update: AnyRecord }) => {
        for (const [id, record] of table(model).entries()) {
          if (matches(record, where)) {
            const next = { ...record, ...update };
            table(model).set(id, next);
            return { ...next };
          }
        }
        return null;
      },
      updateMany: async ({ model, where, update }: { model: string; where: AnyRecord[]; update: AnyRecord }) => {
        let count = 0;
        for (const [id, record] of table(model).entries()) {
          if (matches(record, where)) {
            table(model).set(id, { ...record, ...update });
            count += 1;
          }
        }
        return count;
      },
      delete: async ({ model, where }: { model: string; where: AnyRecord[] }) => {
        for (const [id, record] of table(model).entries()) {
          if (matches(record, where)) table(model).delete(id);
        }
      },
      deleteMany: async ({ model, where }: { model: string; where: AnyRecord[] }) => {
        let count = 0;
        for (const [id, record] of table(model).entries()) {
          if (matches(record, where)) {
            table(model).delete(id);
            count += 1;
          }
        }
        return count;
      },
      count: async ({ model, where }: { model: string; where?: AnyRecord[] }) =>
        [...table(model).values()].filter((record) => !where || matches(record, where)).length,
    },
  };
}

function buildAuth() {
  const db = createMemoryDb();
  const auth = betterAuth({
    secret: "unit-test-secret-that-is-long-enough",
    database: (() => db.adapter) as any,
    emailAndPassword: { enabled: true },
    user: {
      additionalFields: authUserAdditionalFields,
    },
  });
  return { auth, db };
}

const firstUser = (db: ReturnType<typeof createMemoryDb>) => {
  const users = [...db.tables.get("user")!.values()];
  expect(users.length).toBeGreaterThan(0);
  return users[0];
};

const signUp = async (
  auth: ReturnType<typeof betterAuth>,
  body: Record<string, unknown>,
) => {
  // asResponse gives us the real Set-Cookie header (better-auth signs its
  // session cookie), which we replay for authenticated update-user calls.
  const res = await auth.api.signUpEmail({ body, asResponse: true });
  const sessionCookie = res.headers
    .getSetCookie()
    .find((cookie) => cookie.startsWith("better-auth.session_token="));
  expect(sessionCookie).toBeTruthy();
  return sessionCookie!.split(";")[0];
};

describe("auth privilege escalation guard (additionalFields input policy)", () => {
  it("creates a self-registered user with the default USER role", async () => {
    const { auth, db } = buildAuth();
    await auth.api.signUpEmail({
      body: { name: "สมชาย ใจดี", email: "somchai@example.com", password: "password123" },
    });
    expect(firstUser(db).role).toBe("USER");
  });

  it("ignores a client-supplied role on sign-up instead of trusting it", async () => {
    const { auth, db } = buildAuth();
    await auth.api.signUpEmail({
      body: { name: "attacker", email: "attacker@example.com", password: "password123", role: "ADMIN" },
    });
    expect(firstUser(db).role).toBe("USER");
  });

  it("rejects sign-up that tries to set a protected status field", async () => {
    const { auth } = buildAuth();
    await expect(
      auth.api.signUpEmail({
        body: { name: "attacker", email: "attacker2@example.com", password: "password123", isActive: true },
      }),
    ).rejects.toThrow("isActive is not allowed to be set");
  });

  it("rejects an authenticated user escalating role via update-user", async () => {
    const { auth, db } = buildAuth();
    const cookie = await signUp(auth, {
      name: "member",
      email: "member@example.com",
      password: "password123",
    });

    await expect(
      auth.api.updateUser({
        body: { role: "ADMIN" },
        headers: { cookie },
      }),
    ).rejects.toThrow("role is not allowed to be set");
    expect(firstUser(db).role).toBe("USER");
  });

  it("rejects an authenticated user self-deleting or deactivating via update-user", async () => {
    const { auth, db } = buildAuth();
    const cookie = await signUp(auth, {
      name: "member",
      email: "member2@example.com",
      password: "password123",
    });

    await expect(
      auth.api.updateUser({
        body: { deletedAt: new Date().toISOString() },
        headers: { cookie },
      }),
    ).rejects.toThrow("deletedAt is not allowed to be set");
    // Falsy payloads are silently dropped by Better Auth (then rejected as
    // "No fields to update"); either way the value must never persist.
    await auth.api.updateUser({ body: { isActive: false }, headers: { cookie } }).catch(() => {});
    expect(firstUser(db).deletedAt).toBeUndefined();
    expect(firstUser(db).isActive).toBeUndefined();
  });
});
