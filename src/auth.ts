import "server-only";
import NextAuth from "next-auth";
import { FirestoreAdapter } from "@auth/firebase-adapter";
import { getAdminDb } from "@/lib/firebase";
import { authConfig } from "./auth.config";

/**
 * Full NextAuth configuration with Firestore adapter.
 * This runs in Node.js runtime only (not Edge).
 */
export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  adapter: FirestoreAdapter(getAdminDb()),
  session: { strategy: "jwt" },
  callbacks: {
    ...authConfig.callbacks,
    session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
});
