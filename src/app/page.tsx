// Local - Actions
import { getSentinels } from "@/actions/fetch-actions";

// Local - Components
import { DashboardShell } from "@/components/dashboard/DashboardShell";

// Local - UI
import { Toaster } from "@/components/ui/sonner";

export default async function DashboardPage() {
  const sentinels = await getSentinels();

  return (
    <>
      <Toaster position="top-right" />
      <main className="max-w-4xl mx-auto py-10 px-4">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">
            🛡️ LeaseSentinel
          </h1>
          <p className="text-muted-foreground mt-2">
            Autopilot for lease administration. Never miss a deadline.
          </p>
        </div>

        {/* Dashboard Shell (Client Component with Optimistic UI) */}
        <DashboardShell initialSentinels={sentinels} />
      </main>
    </>
  );
}
