import NextAuth from "next-auth";
import { authConfig } from "./auth.config";
import { NextResponse } from "next/server";

const { auth } = NextAuth(authConfig);

export const proxy = auth((req) => {
  const isLoggedIn = !!req.auth;
  const pathname = req.nextUrl.pathname;

  const isAuthRoute = pathname.startsWith("/api/auth");
  const isLoginRoute = pathname.startsWith("/login");
  const isStaticAsset =
    pathname.startsWith("/_next") ||
    pathname.includes(".");

  if (isAuthRoute || isStaticAsset) {
    return NextResponse.next();
  }

  if (isLoggedIn) {
    if (isLoginRoute) {
      return NextResponse.redirect(new URL("/", req.url));
    }
    return NextResponse.next();
  }

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
