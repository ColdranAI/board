"use client";

import { createAuthClient } from "better-auth/react";
import { magicLinkClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_BETTER_AUTH_URL || "http://localhost:3000",
  plugins: [
    magicLinkClient(),
  ],
});

export const {
  signIn,
  signOut,
  signUp,
  useSession,
  getSession,
} = authClient;

// Legacy compatibility functions
export async function legacySignIn(
  provider: string,
  options?: { email?: string; password?: string; callbackUrl?: string }
) {
  if (provider === "email" && options?.email && options?.password) {
    return await signIn.email({
      email: options.email,
      password: options.password,
      callbackURL: options.callbackUrl,
    });
  } else if (provider === "resend" && options?.email) {
    return await signIn.magicLink({
      email: options.email,
      callbackURL: options.callbackUrl,
    });
  } else if (provider === "google") {
    return await signIn.social({
      provider: "google",
      callbackURL: options?.callbackUrl || "/dashboard",
    });
  } else if (provider === "github") {
    return await signIn.social({
      provider: "github", 
      callbackURL: options?.callbackUrl || "/dashboard",
    });
  }
}

export async function legacySignOut() {
  await signOut({
    fetchOptions: {
      onSuccess: () => {
        window.location.href = "/";
      },
    },
  });
}
