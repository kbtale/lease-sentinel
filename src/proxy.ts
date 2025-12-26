import NextAuth from "next-auth";
import { authConfig } from "./auth.config";
import { NextResponse } from "next/server";

const { auth } = NextAuth(authConfig);

export const proxy = auth((req) => {
  const isLoggedIn = !!req.auth;
  const pathname = req.nextUrl.pathname;

  // Auth API routes must always be accessible
  const isAuthRoute = pathname.startsWith("/api/auth");
  
  // Login pages are public
  const isLoginRoute = pathname.startsWith("/login");
  
  // Static assets
  const isStaticAsset =
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api-docs") ||
    pathname.includes(".");

  // Always allow auth routes and static assets
  if (isAuthRoute || isStaticAsset) {
    return NextResponse.next();
  }

  // If logged in, allow access but redirect away from login page
  if (isLoggedIn) {
    if (isLoginRoute) {
      return NextResponse.redirect(new URL("/", req.url));
    }
    return NextResponse.next();
  }

  // Not logged in - allow login page, redirect everything else
  if (isLoginRoute) {
    return NextResponse.next();
  }

  const signInUrl = new URL("/login", req.url);
  signInUrl.searchParams.set("callbackUrl", req.url);
  return NextResponse.redirect(signInUrl);
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
