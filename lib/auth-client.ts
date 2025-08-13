"use client";

export async function signIn(
  provider: string,
  options?: { email?: string; callbackUrl?: string }
) {
  if (provider === "resend") {
    await fetch("/api/auth/resend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: options?.email,
        callbackUrl: options?.callbackUrl,
      }),
    });
  } else {
    const params = new URLSearchParams();
    if (options?.callbackUrl) {
      params.set("callbackUrl", options.callbackUrl);
    }
    window.location.href = `/api/auth/${provider}?${params.toString()}`;
  }
}

export async function signOut() {
  await fetch("/api/auth/signout", { method: "POST" });
  window.location.href = "/";
}
