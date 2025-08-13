import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import Resend from "better-auth/providers/resend";
import Google from "better-auth/providers/google";
import GitHub from "better-auth/providers/github";

import { db as drizzle } from "@/lib/db";
import { env } from "@/lib/env";

export const betterAuthInstance = betterAuth({
  baseURL: env.AUTH_URL,
  secret: env.AUTH_SECRET,
  adapter: drizzleAdapter(drizzle),
  providers: [
    Resend({ apiKey: env.AUTH_RESEND_KEY, from: env.EMAIL_FROM }),
    Google({
      clientId: env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: env.GOOGLE_CLIENT_SECRET ?? "",
      allowDangerousEmailAccountLinking: true,
    }),
    GitHub({
      clientId: env.GITHUB_CLIENT_ID ?? "",
      clientSecret: env.GITHUB_CLIENT_SECRET ?? "",
      allowDangerousEmailAccountLinking: true,
    }),
  ],
});

export const { handlers, auth, signIn, signOut } = betterAuthInstance;
