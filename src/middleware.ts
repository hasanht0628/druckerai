import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PASSWORD = process.env.APP_PASSWORD;
const COOKIE_NAME = "drucker-auth";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow login page and login API through always
  if (pathname === "/auth/login" || pathname === "/api/auth/login") {
    return NextResponse.next();
  }

  // If no password set, allow everything (localhost dev)
  if (!PASSWORD) {
    return NextResponse.next();
  }

  const authCookie = request.cookies.get(COOKIE_NAME);
  const isAuthenticated = authCookie?.value === PASSWORD;

  if (!isAuthenticated) {
    const loginUrl = new URL("/auth/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
