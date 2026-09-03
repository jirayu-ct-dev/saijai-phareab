import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "~~/server/utils/prisma";
import { renderResetPasswordEmail, renderVerificationEmail, sendEmail } from "~~/server/utils/email";
import { isInternalCustomerEmail } from "~~/server/utils/customerAccount";
import { authUserAdditionalFields } from "~/utils/auth-user-fields";

const extraOrigins = process.env.BETTER_AUTH_TRUSTED_ORIGINS
  ? process.env.BETTER_AUTH_TRUSTED_ORIGINS.split(",").map((s) => s.trim())
  : [];

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL,
  trustedOrigins: [
    ...(process.env.BETTER_AUTH_URL ? [process.env.BETTER_AUTH_URL] : []),
    ...extraOrigins,
  ],
  trustedProxies: (process.env.TRUSTED_PROXIES ?? "127.0.0.1,::1").split(",").map((s) => s.trim()),
  advanced: {
    ipAddress: {
      trustedProxies: (process.env.TRUSTED_PROXIES ?? "127.0.0.1,::1").split(",").map((s) => s.trim()),
    },
  },
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  session: {
    // Explicit session policy: 7-day expiry, refreshed once a day while active.
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
  },
  emailAndPassword: {
    enabled: true,
    sendResetPassword: async ({ user, url }) => {
      const { subject, html, text } = renderResetPasswordEmail({ name: user.name ?? null, url });
      await sendEmail({ to: user.email, subject, html, text });
    },
    resetPasswordTokenExpiresIn: 3600,
  },
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      const { subject, html, text } = renderVerificationEmail({ name: user.name ?? null, url });
      await sendEmail({ to: user.email, subject, html, text });
    },
  },
  account: {
    accountLinking: {
      // Customers created at the POS must claim their existing User explicitly.
      // A normal LINE sign-in must never merge by a matching provider email.
      disableImplicitLinking: true,
    },
  },
  socialProviders: {
    line: {
      clientId: process.env.LINE_LIFF_CLIENT_ID as string,
      clientSecret: process.env.LINE_LIFF_CLIENT_SECRET as string,
    },
  },
  user: {
    changeEmail: {
      enabled: true,
      updateEmailWithoutVerification: false,
    },
    additionalFields: authUserAdditionalFields,
  },
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          if (isInternalCustomerEmail(user.email)) {
            throw new Error("Internal customer email cannot be registered");
          }
        },
      },
      update: {
        before: async (user) => {
          if (typeof user.email === "string" && isInternalCustomerEmail(user.email)) {
            throw new Error("Internal customer email cannot be used as a real email");
          }
        },
      },
    },
  },
});
