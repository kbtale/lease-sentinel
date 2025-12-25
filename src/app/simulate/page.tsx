// Developer tool to verify AI extraction before building the main Dashboard UI

"use client";

// React
import { useActionState, useState } from "react";

// Local - Actions
import { createSentinel } from "@/actions/sentinel.actions";
import { triggerCronManual } from "@/actions/admin.actions";

// Local - UI
import Link from "next/link";

// ============================================================================
// Types
// ============================================================================

interface FormState {
  success: boolean;
  message: string;
  errors?: Record<string, string[]>;
}

interface CronResult {
  success: boolean;
  message: string;
  data?: {
    processed?: number;
  };
}

// ============================================================================
// Component
// ============================================================================

export default function SimulatePage() {
  // Hooks - Form
  const [state, formAction, isPending] = useActionState<FormState | null, FormData>(
    createSentinel,
    null
  );

  // Hooks - Cron trigger
  const [cronResult, setCronResult] = useState<CronResult | null>(null);
  const [isTriggeringCron, setIsTriggeringCron] = useState(false);

  // Derived state
  const hasResult = state !== null;
  const isSuccess = state?.success === true;

  // Handlers
  async function handleTriggerCron() {
    setIsTriggeringCron(true);
    setCronResult(null);

    try {
      const result = await triggerCronManual();
      setCronResult(result);
    } finally {
      setIsTriggeringCron(false);
    }
  }

  // Render
  return (
    <main className="min-h-screen p-8 bg-background">
      <div className="max-w-2xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            🧪 Simulator V2
          </h1>
          <p className="text-muted-foreground mt-2">
            test the AI extraction pipeline and cron system.
          </p>
          <Link
            href="/"
            className="text-sm text-blue-600 hover:underline mt-2 inline-block"
          >
            ← Back to Home
          </Link>
        </div>

        {/* Test Extraction Form */}
        <form action={formAction} className="space-y-6 bg-card p-6 rounded-lg border">
          <div className="space-y-2">
            <label htmlFor="clause" className="text-sm font-medium">
              Lease Clause
            </label>
            <textarea
              id="clause"
              name="clause"
              placeholder="Paste lease text... (e.g., 'Notice must be given 6 months before Dec 31, 2025')"
              rows={4}
              required
              className="w-full px-3 py-2 border rounded-md resize-none bg-background text-foreground"
            />
            {state?.errors?.clause && (
              <p className="text-sm text-red-500">{state.errors.clause[0]}</p>
            )}
          </div>

          <div className="space-y-2">
            <label htmlFor="webhookUrl" className="text-sm font-medium">
              Webhook URL
            </label>
            <input
              id="webhookUrl"
              name="webhookUrl"
              type="url"
              placeholder="https://discord.com/api/webhooks/..."
              required
              className="w-full px-3 py-2 border rounded-md bg-background text-foreground"
            />
            {state?.errors?.webhookUrl && (
              <p className="text-sm text-red-500">{state.errors.webhookUrl[0]}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="w-full px-4 py-2 bg-primary text-primary-foreground rounded-md font-medium hover:opacity-90 disabled:opacity-50"
          >
            {isPending ? "Testing..." : "Test Extraction"}
          </button>
        </form>

        {hasResult && (
          <div
            className={`p-4 rounded-md border ${
              isSuccess
                ? "bg-green-50 border-green-500 text-green-800"
                : "bg-red-50 border-red-500 text-red-800"
            }`}
          >
            <p className="font-medium">
              {isSuccess ? "✅ Success" : "❌ Error"}
            </p>
            <p className="text-sm mt-1">{state?.message}</p>
          </div>
        )}

        {/* System Override Section */}
        <div className="bg-card p-6 rounded-lg border border-red-200">
          <h2 className="text-xl font-semibold text-red-600 mb-2">
            ⚠️ System Override
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            Manually trigger the cron job to process all pending sentinels for today.
          </p>

          <button
            type="button"
            onClick={handleTriggerCron}
            disabled={isTriggeringCron}
            className="w-full px-4 py-2 bg-red-600 text-white rounded-md font-medium hover:bg-red-700 disabled:opacity-50"
          >
            {isTriggeringCron ? "Triggering..." : "Trigger Cron Job Now"}
          </button>

          {cronResult && (
            <div
              className={`mt-4 p-4 rounded-md border ${
                cronResult.success
                  ? "bg-green-50 border-green-500 text-green-800"
                  : "bg-red-50 border-red-500 text-red-800"
              }`}
            >
              <p className="font-medium">
                {cronResult.success ? "✅ Cron Triggered" : "❌ Cron Error"}
              </p>
              <p className="text-sm mt-1">{cronResult.message}</p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
