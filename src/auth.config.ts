import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";

/**
 * Shared auth configuration for both Edge (proxy) and Node.js (auth.ts).
 * Does NOT call NextAuth() - just exports the config object.
 */
export const authConfig = {
  debug: true,
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
} satisfies NextAuthConfig;
