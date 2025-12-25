"use client";

// React
import { useOptimistic, useTransition, useRef } from "react";

// Third Party
import { addDays, format } from "date-fns";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import Image from "next/image";

// Local - Types
import { Sentinel } from "@/models/schema";

// Local - Actions
import { createSentinel } from "@/actions/sentinel.actions";

// Local - Components
import { SentinelCard } from "@/components/dashboard/SentinelCard";

// Local - UI
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

// ============================================================================
// Types
// ============================================================================

interface User {
  name?: string | null;
  email?: string | null;
  image?: string | null;
}

interface DashboardShellProps {
  initialSentinels: Sentinel[];
  user: User;
}

// ============================================================================
// Component
// ============================================================================

export function DashboardShell({ initialSentinels, user }: DashboardShellProps) {
  // Refs
  const clauseRef = useRef<HTMLTextAreaElement>(null);

  // Hooks
  const [isPending, startTransition] = useTransition();
  const [optimisticSentinels, addOptimistic] = useOptimistic<Sentinel[], Sentinel>(
    initialSentinels,
    (state, newSentinel) => [newSentinel, ...state]
  );

  // Derived state
  const hasSentinels = optimisticSentinels.length > 0;

  // Handlers
  function handleDemoFill() {
    // Calculate expiration 180 days out so AI extracts today as the trigger date
    const expirationDate = addDays(new Date(), 180);
    const formattedDate = format(expirationDate, "MMMM d, yyyy");
    const demoClause = `Tenant must provide notice 180 days prior to expiration on ${formattedDate}.`;

    if (clauseRef.current) {
      clauseRef.current.value = demoClause;
    }
  }

  async function handleSubmit(formData: FormData) {
    const clause = formData.get("clause") as string;
    const webhookUrl = formData.get("webhookUrl") as string;

    // Temporary sentinel for optimistic display while server processes
    const optimisticSentinel: Sentinel = {
      id: `temp-${Date.now()}`,
      userId: user.email || "temp",
      eventName: "Analyzing...",
      triggerDate: new Date().toISOString().split("T")[0],
      originalClause: clause,
      webhookUrl: webhookUrl,
      status: "PENDING",
      createdAt: new Date(),
    };

    startTransition(async () => {
      addOptimistic(optimisticSentinel);
      const result = await createSentinel(null, formData);

      if (result.success) {
        toast.success(result.message);
      } else {
        toast.error(result.message);
      }
    });
  }

  // Render
  return (
    <>
      {/* Header */}
      <header className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">🛡️ LeaseSentinel</h1>
          <p className="text-muted-foreground mt-1">
            Autopilot for lease administration.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground hidden sm:block">
            {user.name || user.email}
          </span>
          {user.image && (
            <Image
              src={user.image}
              alt={user.name || "User avatar"}
              width={40}
              height={40}
              className="rounded-full border"
            />
          )}
        </div>
      </header>

      {/* Create Form */}
      <section className="mb-8">
        <Card>
          <CardHeader>
            <CardTitle>Create New Sentinel</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="clause">Lease Clause</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleDemoFill}
                    className="h-7 text-xs gap-1"
                  >
                    <Sparkles className="h-3 w-3" />
                    Auto-Fill Demo Data
                  </Button>
                </div>
                <Textarea
                  ref={clauseRef}
                  id="clause"
                  name="clause"
                  placeholder="Paste your lease clause here... (e.g., 'Notice must be given 6 months before Dec 31, 2025')"
                  rows={4}
                  required
                  className="resize-none"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="webhookUrl">Webhook URL</Label>
                <Input
                  id="webhookUrl"
                  name="webhookUrl"
                  type="url"
                  placeholder="https://discord.com/api/webhooks/..."
                  required
                />
              </div>

              <Button type="submit" disabled={isPending} className="w-full">
                {isPending ? "Analyzing..." : "Create Sentinel"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </section>

      {/* Divider */}
      <hr className="my-8 border-border" />

      {/* Sentinels Grid */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Active Monitors</h2>

        {hasSentinels ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {optimisticSentinels.map((sentinel) => (
              <SentinelCard key={sentinel.id} sentinel={sentinel} />
            ))}
          </div>
        ) : (
          <div className="text-center py-12 bg-muted/50 rounded-lg border border-dashed">
            <p className="text-muted-foreground">
              No monitors active. Paste a lease clause above to start.
            </p>
          </div>
        )}
      </section>
    </>
  );
}
