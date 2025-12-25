import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { FirestoreAdapter } from "@auth/firebase-adapter";
import { getAdminDb } from "@/lib/firebase";

/**
 * NextAuth v5 configuration with Firestore adapter.
 * I use JWT sessions to avoid database session complexity on serverless,
 * while still syncing user data via the Firestore adapter.
 */
export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [Google],
  adapter: FirestoreAdapter(getAdminDb()),
  session: {
    strategy: "jwt",
  },
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
});
