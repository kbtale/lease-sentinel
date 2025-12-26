import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";

/**
 * Shared auth configuration for Edge runtime (proxy.ts).
 * Does NOT include the Resend provider since it requires a database adapter.
 * The full auth.ts adds Resend + FirestoreAdapter for Node.js runtime.
 */
export const authConfig = {
  debug: process.env.NODE_ENV === "development",
  trustHost: true,
  secret: process.env.AUTH_SECRET,
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    jwt({ token, user }) {
      if (user) token.id = user.id;
      return token;
    },
    authorized({ auth }) {
      return !!auth?.user;
    },
  },
  pages: {
    signIn: "/login",
    verifyRequest: "/login/verify",
  },
} satisfies NextAuthConfig;
