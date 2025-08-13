import { NextRequest, NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

export async function middleware(request: NextRequest) {
  const sessionCookie = getSessionCookie(request);
  const { pathname } = request.nextUrl;

  const isAuthPage = pathname.startsWith("/auth") || pathname.startsWith("/login");
  const isProtectedPage = !pathname.startsWith("/api") && 
                         !isAuthPage && 
                         pathname !== "/";

  if (!sessionCookie && isProtectedPage) {
    return NextResponse.redirect(new URL("/auth/signin", request.url));
  }

  if (sessionCookie && isAuthPage) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/auth/:path*", "/login/:path*"],
};