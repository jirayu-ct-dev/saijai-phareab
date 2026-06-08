import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "~~/server/utils/prisma";
import { renderResetPasswordEmail, renderVerificationEmail, sendEmail } from "~~/server/utils/email";

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
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
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
  socialProviders: {
    line: {
      clientId: process.env.LINE_LIFF_CLIENT_ID as string,
      clientSecret: process.env.LINE_LIFF_CLIENT_SECRET as string,
    },
  },
  user: {
    additionalFields: {
      role: {
        type: "string",
        required: true,
      },
      phoneNumber: {
        type: "string",
        required: false,
      },
      isActive: {
        type: "boolean",
        required: false,
      },
      deletedAt: {
        type: "date",
        required: false,
      },
      deletedById: {
        type: "string",
        required: false,
      },
    },
  },
});