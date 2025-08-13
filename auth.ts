<<<<<<< Updated upstream
import NextAuth from "next-auth";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import Resend from "next-auth/providers/resend";
import GoogleProvider from "next-auth/providers/google";
import GitHubProvider from "next-auth/providers/github";
import { db as drizzle } from "@/lib/db";
import { env } from "@/lib/env";

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: DrizzleAdapter(drizzle),
  providers: [
    Resend({
      from: env.EMAIL_FROM,
    }),
    GoogleProvider({
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      allowDangerousEmailAccountLinking: true,
    }),
    GitHubProvider({
      clientId: env.GITHUB_CLIENT_ID,
      clientSecret: env.GITHUB_CLIENT_SECRET,
      allowDangerousEmailAccountLinking: true,
    }),
  ],
  pages: {
    signIn: "/auth/signin",
    verifyRequest: "/auth/verify-request",
    error: "/auth/error",
  },
  callbacks: {
    async signIn() {
      return true;
    },
    async redirect({ url, baseUrl }) {
      if (url.includes("/invite/accept")) {
        return url.startsWith("/") ? `${baseUrl}${url}` : url;
      }
      if (url.startsWith("/")) return `${baseUrl}/dashboard`;
      else if (new URL(url).origin === baseUrl) return url;
      return `${baseUrl}/dashboard`;
    },
  },
=======
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/lib/db";
import { users, accounts, sessions, verificationTokens } from "@/lib/db/schema";
import { Resend } from "resend";

const resend = new Resend(process.env.AUTH_RESEND_KEY);

async function sendEmail({ to, subject, text, html }: { to: string; subject: string; text: string; html?: string }) {
  try {
    if (process.env.NODE_ENV === "development") {
      console.log("EMAIL (DEV MODE)->", { to, subject, text });
      return;
    }
    
    await resend.emails.send({
      from: process.env.EMAIL_FROM || "onboarding@resend.dev",
      to,
      subject,
      text,
      html,
    });
  } catch (error) {
    console.error("Failed to send email:", error);
  }
}

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
  }),
  
  emailAndPassword: {
    enabled: true,
    sendResetPassword: async ({user, url, token}) => {
      await sendEmail({
        to: user.email,
        subject: "Reset your password - Coldboard",
        text: `Click the link to reset your password: ${url}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Reset your password</h2>
            <p>Click the button below to reset your password:</p>
            <a href="${url}" style="background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Reset Password</a>
            <p>If the button doesn't work, copy and paste this link: ${url}</p>
            <p>This link will expire in 1 hour.</p>
          </div>
        `,
      });
    },
  },
  
  emailVerification: {
    sendVerificationEmail: async ({user, url, token}) => {
      await sendEmail({
        to: user.email,
        subject: "Verify your email - Coldboard",
        text: `Click the link to verify your email: ${url}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Welcome to Coldboard!</h2>
            <p>Click the button below to verify your email address:</p>
            <a href="${url}" style="background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Verify Email</a>
            <p>If the button doesn't work, copy and paste this link: ${url}</p>
            <p>This link will expire in 24 hours.</p>
          </div>
        `,
      });
    },
  },
  
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
    github: {
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    },
  },
  
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
  },
>>>>>>> Stashed changes
});
