// I built this page to verify the AI extraction logic before actually investing my time in the main Dashboard UI.

"use client";

// React
import { useActionState } from "react";

// Local - Actions
import { createSentinel } from "@/actions/sentinel.actions";

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

// ============================================================================
// Component
// ============================================================================

export default function SimulatePage() {
  // Hooks
  const [state, formAction, isPending] = useActionState<FormState | null, FormData>(
    createSentinel,
    null
  );

  // Derived state
  const hasResult = state !== null;
  const isSuccess = state?.success === true;

  // Render
  return (
    <main className="min-h-screen p-8 bg-background">
      <div className="max-w-2xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            🧪 Simulator V1
          </h1>
          <p className="text-muted-foreground mt-2">
            Developer tool to test the AI extraction pipeline.
          </p>
          <Link
            href="/"
            className="text-sm text-blue-600 hover:underline mt-2 inline-block"
          >
            ← Back to Home
          </Link>
        </div>

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
      </div>
    </main>
  );
}
