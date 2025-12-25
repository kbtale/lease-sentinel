"use server";

import { signIn, signOut } from "@/auth";

/**
 * Server action to initiate Google sign-in.
 * This allows client components to trigger auth without importing server modules.
 */
export async function loginAction() {
  await signIn("google");
}

/**
 * Server action to sign out the user.
 * This allows client components to trigger sign-out without importing server modules.
 */
export async function logoutAction() {
  await signOut();
}
