// Local - Auth
import { auth } from "@/auth";

// Local - Actions
import { getSentinels } from "@/actions/fetch-actions";

// Local - Components
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { SignInButton } from "@/components/auth/SignInButton";

// Local - UI
import { Toaster } from "@/components/ui/sonner";

// Force dynamic rendering - Firebase credentials unavailable at build time
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await auth();

  // If not logged in, show landing page with sign-in button
  if (!session) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-8">
        <div className="text-center space-y-6 max-w-md">
          <h1 className="text-4xl font-bold tracking-tight">🛡️ LeaseSentinel</h1>
          <p className="text-muted-foreground text-lg">
            Autopilot for lease administration. Never miss a deadline.
          </p>
          <SignInButton />
        </div>
      </main>
    );
  }

  const sentinels = await getSentinels();

  return (
    <>
      <Toaster position="top-right" />
      <main className="max-w-4xl mx-auto py-10 px-4">
        <DashboardShell
          initialSentinels={sentinels}
          user={session.user ?? { name: null, email: null, image: null }}
        />
      </main>
    </>
  );
}
