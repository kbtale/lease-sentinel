"use server";

import { signIn, signOut } from "@/auth";

/**
 * Server action to initiate Google OAuth sign-in.
 * 
 * @summary Triggers Google authentication flow from client components.
 * @category Auth Configuration
 * 
 * @security
 * **OAuth Flow**: Redirects to Google's OAuth consent screen. Authentication
 * is handled entirely by NextAuth and Google—no credentials are processed
 * by this function.
 * 
 * @remarks
 * This wrapper exists because client components cannot directly import from
 * `@/auth` (which uses `"server-only"`). By exposing authentication as a
 * Server Action, client components can trigger auth without importing
 * server-side modules.
 * 
 * @example
 * ```tsx
 * // Client component usage
 * "use client";
 * import { loginAction } from "@/actions/auth.actions";
 * 
 * export function LoginButton() {
 *   return (
 *     <form action={loginAction}>
 *       <button type="submit">Sign in with Google</button>
 *     </form>
 *   );
 * }
 * ```
 * 
 * @see {@link logoutAction} for the sign-out counterpart.
 */
export async function loginAction() {
  await signIn("google");
}

/**
 * Server action to sign out the current user.
 * 
 * @summary Terminates user session and clears authentication cookies.
 * @category Auth Configuration
 * 
 * @security
 * **Session Termination**: Clears the JWT session cookie. Does not revoke
 * the Google OAuth token—users will still be able to sign back in with
 * one click if they remain signed into Google.
 * 
 * @remarks
 * Like {@link loginAction}, this wrapper enables client components to trigger
 * sign-out without importing server-side auth modules.
 * 
 * @example
 * ```tsx
 * // Client component usage
 * "use client";
 * import { logoutAction } from "@/actions/auth.actions";
 * 
 * export function LogoutButton() {
 *   return (
 *     <form action={logoutAction}>
 *       <button type="submit">Sign out</button>
 *     </form>
 *   );
 * }
 * ```
 * 
 * @see {@link loginAction} for the sign-in counterpart.
 */
export async function logoutAction() {
  await signOut();
}

/**
 * Server action to initiate Magic Link email sign-in.
 * 
 * @summary Sends a magic link to the provided email address.
 * @category Auth Configuration
 * 
 * @security
 * **Email Verification**: Resend handles email delivery. The magic link contains
 * a time-limited token that expires after a single use.
 * 
 * @remarks
 * This triggers the Resend provider to send a verification email containing
 * a secure, single-use sign-in link. The user clicks the link to authenticate.
 * 
 * @param email - The email address to send the magic link to.
 * 
 * @example
 * ```tsx
 * // Client component usage
 * "use client";
 * import { signInWithEmail } from "@/actions/auth.actions";
 * 
 * const handleSubmit = async (email: string) => {
 *   await signInWithEmail(email);
 *   // Show "check your email" message
 * };
 * ```
 */
export async function signInWithEmail(email: string) {
  await signIn("resend", { email, redirect: false });
}
