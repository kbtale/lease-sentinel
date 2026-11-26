"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { createSentinel } from "@/actions/sentinel.actions";
import { triggerCronManual } from "@/actions/admin.actions";
import type { NotificationMethod } from "@/models/schema";

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

interface SimulateClientProps {
  isAdmin: boolean;
  userEmail: string;
}

export function SimulateClient({ isAdmin, userEmail }: SimulateClientProps) {
  const [state, formAction, isPending] = useActionState<FormState | null, FormData>(
    createSentinel,
    null
  );
  const [notificationMethod, setNotificationMethod] =
    useState<NotificationMethod>("email");
  const [notificationTarget, setNotificationTarget] = useState(userEmail);
  const [cronResult, setCronResult] = useState<CronResult | null>(null);
  const [isTriggeringCron, setIsTriggeringCron] = useState(false);

  const hasResult = state !== null;
  const isSuccess = state?.success === true;

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

  return (
    <main className="min-h-screen p-8 bg-zinc-950 text-zinc-50">
      <div className="max-w-2xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Pipeline Simulator
          </h1>
          <p className="text-zinc-400 mt-2">
            Verify live AI clause extraction and alert validation against your account.
          </p>
          <div className="flex gap-4 mt-3">
            <Link
              href="/"
              className="text-sm text-indigo-400 hover:underline"
            >
              ← Back to Dashboard
            </Link>
            <Link
              href="/demo"
              className="text-sm text-zinc-400 hover:text-zinc-200 hover:underline"
            >
              Public Demo →
            </Link>
          </div>
        </div>

        <form
          action={formAction}
          className="space-y-5 bg-zinc-900/70 p-6 rounded-xl border border-zinc-800"
        >
          <div className="space-y-2">
            <label htmlFor="propertyLabel" className="text-sm font-medium text-zinc-200">
              Property Label (optional)
            </label>
            <input
              id="propertyLabel"
              name="propertyLabel"
              type="text"
              placeholder="e.g., 450 Market St, Suite 1200"
              className="w-full px-3 py-2 border border-zinc-800 rounded-md bg-zinc-950 text-zinc-100"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="clause" className="text-sm font-medium text-zinc-200">
              Lease Clause
            </label>
            <textarea
              id="clause"
              name="clause"
              placeholder="Paste lease text... (e.g., 'Notice must be given 60 days before Dec 31, 2026')"
              rows={4}
              required
              className="w-full px-3 py-2 border border-zinc-800 rounded-md resize-none bg-zinc-950 text-zinc-100 font-mono text-sm"
            />
            {state?.errors?.clause && (
              <p className="text-sm text-rose-400">{state.errors.clause[0]}</p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-2">
              <label htmlFor="notificationMethod" className="text-sm font-medium text-zinc-200">
                Channel
              </label>
              <select
                id="notificationMethod"
                name="notificationMethod"
                value={notificationMethod}
                onChange={(e) => {
                  const next = e.target.value as NotificationMethod;
                  setNotificationMethod(next);
                  setNotificationTarget(next === "email" ? userEmail : "");
                }}
                className="w-full h-10 px-3 border border-zinc-800 rounded-md bg-zinc-950 text-zinc-100 text-sm"
              >
                <option value="email">Email (Resend)</option>
                <option value="slack">Slack Webhook</option>
                <option value="custom">Custom Webhook</option>
                <option value="sms">SMS (E.164)</option>
              </select>
            </div>

            <div className="sm:col-span-2 space-y-2">
              <label htmlFor="notificationTarget" className="text-sm font-medium text-zinc-200">
                Notification Target
              </label>
              <input
                id="notificationTarget"
                name="notificationTarget"
                type={
                  notificationMethod === "email"
                    ? "email"
                    : notificationMethod === "sms"
                      ? "tel"
                      : "url"
                }
                value={notificationTarget}
                onChange={(e) => setNotificationTarget(e.target.value)}
                placeholder={
                  notificationMethod === "email"
                    ? "alerts@example.com"
                    : notificationMethod === "sms"
                      ? "+14155552671"
                      : "https://hooks.slack.com/services/..."
                }
                required
                className="w-full h-10 px-3 border border-zinc-800 rounded-md bg-zinc-950 text-zinc-100"
              />
              {state?.errors?.notificationTarget && (
                <p className="text-sm text-rose-400">
                  {state.errors.notificationTarget[0]}
                </p>
              )}
            </div>
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="w-full px-4 py-2.5 bg-zinc-100 text-zinc-950 rounded-md font-medium hover:bg-white disabled:opacity-50"
          >
            {isPending ? "Extracting & Saving..." : "Test Extraction"}
          </button>
        </form>

        {hasResult && (
          <div
            role="status"
            className={`p-4 rounded-md border ${
              isSuccess
                ? "bg-emerald-950/50 border-emerald-500/40 text-emerald-200"
                : "bg-rose-950/50 border-rose-500/40 text-rose-200"
            }`}
          >
            <p className="font-medium">
              {isSuccess ? "Success" : "Error"}
            </p>
            <p className="text-sm mt-1">{state?.message}</p>
          </div>
        )}

        {isAdmin && (
          <section className="bg-zinc-900/70 p-6 rounded-xl border border-rose-500/30">
            <h2 className="text-lg font-semibold text-rose-400 mb-2">
              Admin System Override
            </h2>
            <p className="text-sm text-zinc-400 mb-4">
              Manually trigger the cron job to process pending sentinels and due lead-time reminders.
            </p>

            <button
              type="button"
              onClick={handleTriggerCron}
              disabled={isTriggeringCron}
              className="w-full px-4 py-2.5 bg-rose-600 text-white rounded-md font-medium hover:bg-rose-500 disabled:opacity-50"
            >
              {isTriggeringCron ? "Triggering..." : "Trigger Cron Job Now"}
            </button>

            {cronResult && (
              <div
                className={`mt-4 p-4 rounded-md border ${
                  cronResult.success
                    ? "bg-emerald-950/50 border-emerald-500/40 text-emerald-200"
                    : "bg-rose-950/50 border-rose-500/40 text-rose-200"
                }`}
              >
                <p className="font-medium">
                  {cronResult.success ? "Cron Triggered" : "Cron Error"}
                </p>
                <p className="text-sm mt-1">{cronResult.message}</p>
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
