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
    <div className="min-h-screen bg-zinc-950 relative">
      {/* Spotlight Effect */}
      <div className="absolute inset-0 -z-10 h-full w-full bg-zinc-950 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(79,70,229,0.15),rgba(255,255,255,0))]" />
      
      <Toaster position="top-right" theme="dark" />
      <main className="max-w-6xl mx-auto py-10 px-4">
        <DashboardShell
          initialSentinels={sentinels}
          user={session.user ?? { name: null, email: null, image: null }}
        />
      </main>
    </div>
  );
}
