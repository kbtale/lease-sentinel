// Local - Auth
import { auth } from "@/auth";

// Local - Actions
import { getSentinels } from "@/actions/fetch-actions";

// Local - Components
import { DashboardShell } from "@/components/dashboard/DashboardShell";

// Local - UI
import { Toaster } from "@/components/ui/sonner";

// Force dynamic rendering - Firebase credentials unavailable at build time
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await auth();

  // Middleware handles auth redirect - this is a safety fallback
  if (!session) {
    return null;
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
