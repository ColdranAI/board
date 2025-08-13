import "server-only";

interface Env {
  NODE_ENV: "development" | "production" | "test";
  DATABASE_URL: string;
  EMAIL_FROM: string;
  AUTH_RESEND_KEY: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
  NEXT_PUBLIC_BETTER_AUTH_URL: string;
  AUTH_SECRET: string;
}

export const env: Env = {
  NODE_ENV: process.env.NODE_ENV as "development" | "production" | "test",
  DATABASE_URL: process.env.DATABASE_URL!,
  EMAIL_FROM: process.env.EMAIL_FROM!,
  AUTH_RESEND_KEY: process.env.AUTH_RESEND_KEY!,
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
  GITHUB_CLIENT_ID: process.env.GITHUB_CLIENT_ID,
  GITHUB_CLIENT_SECRET: process.env.GITHUB_CLIENT_SECRET,
  NEXT_PUBLIC_BETTER_AUTH_URL: process.env.NEXT_PUBLIC_BETTER_AUTH_URL!,
  AUTH_SECRET: process.env.AUTH_SECRET!,
};
