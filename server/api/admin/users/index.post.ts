import { Prisma } from "~~/app/generated/prisma/client";
import { prisma } from "~~/server/utils/prisma";
import { requireRole } from "~~/server/utils/auth";
import type { Role } from "~~/shared/types/enums";

type CreateUserBody = {
  email?: string;
  password?: string;
  name?: string | null;
  phoneNumber?: string | null;
  role?: Role;
  emailVerified?: boolean;
};

const ALLOWED_ROLES: Role[] = ["USER", "EMPLOYEE", "ADMIN"];
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default defineEventHandler(async (event) => {
  await requireRole(event, ["ADMIN"]);

  const body = await readBody<CreateUserBody>(event);
  const email = body.email?.trim().toLowerCase();

  if (!email || !EMAIL_REGEX.test(email)) {
    throw createError({ statusCode: 400, statusMessage: "Invalid email" });
  }

  if (body.role && !ALLOWED_ROLES.includes(body.role)) {
    throw createError({ statusCode: 400, statusMessage: "Invalid role" });
  }

  // Hash password if provided
  let hashedPassword: string | undefined;
  if (body.password) {
    const { hashPassword } = await import("better-auth/crypto");
    hashedPassword = await hashPassword(body.password);
  }

  try {
    const user = await prisma.user.create({
      data: {
        email,
        name: body.name?.trim() || null,
        phoneNumber: body.phoneNumber?.trim() || null,
        role: body.role ?? "USER",
        emailVerified: body.emailVerified ?? false,
        ...(hashedPassword
          ? {
              accounts: {
                create: {
                  id: crypto.randomUUID(),
                  providerId: "credential",
                  accountId: email,
                  password: hashedPassword,
                },
              },
            }
          : {}),
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        phoneNumber: true,
        emailVerified: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return user;
  } catch (error) {
    console.error("[POST /api/admin/users]", error);

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw createError({
        statusCode: 409,
        statusMessage: "Email already exists",
      });
    }

    throw createError({
      statusCode: 500,
      statusMessage: "Unable to create user",
    });
  }
});
