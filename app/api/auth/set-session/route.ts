import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { eq, and, gt } from "drizzle-orm";
import { sessions, users } from "@/lib/db/schema";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const sessionToken = searchParams.get("token");
  const redirectTo = searchParams.get("redirectTo");

  if (!sessionToken || !redirectTo) {
    return NextResponse.redirect(new URL("/auth/signin", request.url));
  }

  try {
    // Verify the session token exists in the database
    const session = await db
      .select({
        sessionToken: sessions.sessionToken,
        expires: sessions.expires,
        user: {
          id: users.id,
          name: users.name,
          email: users.email,
        },
      })
      .from(sessions)
      .innerJoin(users, eq(sessions.userId, users.id))
      .where(eq(sessions.sessionToken, sessionToken))
      .limit(1);

    if (!session[0] || session[0].expires < new Date()) {
      return NextResponse.redirect(new URL("/auth/signin", request.url));
    }

    // Create response with redirect
    const response = NextResponse.redirect(new URL(redirectTo, request.url));

    // Set the NextAuth session cookie
    response.cookies.set("authjs.session-token", sessionToken, {
      expires: session[0].expires,
      httpOnly: true,
      secure: env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("Set session error:", error);
    return NextResponse.redirect(new URL("/auth/signin", request.url));
  }
}
