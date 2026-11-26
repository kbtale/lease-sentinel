import "server-only";
import NextAuth from "next-auth";
import Resend from "next-auth/providers/resend";
import { FirestoreAdapter } from "@auth/firebase-adapter";
import { getAdminDb } from "@/lib/firebase";
import { authConfig } from "./auth.config";

export const { handlers, signIn, signOut, auth } = NextAuth(() => ({
  ...authConfig,
  adapter: FirestoreAdapter(getAdminDb()),
  providers: [
    ...authConfig.providers,
    Resend({
      apiKey: process.env.RESEND_API_KEY,
      from: process.env.RESEND_FROM_EMAIL || "LeaseSentinel <onboarding@resend.dev>",
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
}));
