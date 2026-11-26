"use client";

import { Calendar, CheckCircle2, Clock, AlertTriangle, Download } from "lucide-react";
import type { Sentinel } from "@/models/schema";
import { daysUntil, getTodayISO } from "@/lib/date-utils";
import { generateBulkIcs } from "@/lib/ics";
import { Button } from "@/components/ui/button";

interface StatsBarProps {
  sentinels: Sentinel[];
}

export function triggerIcsDownload(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function StatsBar({ sentinels }: StatsBarProps) {
  const today = getTodayISO();
  const activeSentinels = sentinels.filter((s) => s.status === "PENDING");
  const dueWithin30 = activeSentinels.filter((s) => {
    const diff = daysUntil(s.triggerDate, today);
    return diff > 0 && diff <= 30;
  });
  const urgentCount = activeSentinels.filter(
    (s) => daysUntil(s.triggerDate, today) <= 0
  ).length;
  const closedCount = sentinels.filter(
    (s) => s.status === "FIRED" || s.status === "RESOLVED" || s.status === "PAUSED"
  ).length;

  function handleExportAll() {
    if (activeSentinels.length === 0) return;
    const ics = generateBulkIcs(activeSentinels);
    triggerIcsDownload(ics, "leasesentinel-active-deadlines.ics");
  }

  return (
    <section aria-label="Deadline overview" className="space-y-3">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span>Active Monitors</span>
            <Clock className="h-3.5 w-3.5 text-emerald-400" />
          </div>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-zinc-50">
            {activeSentinels.length}
          </p>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span>Due Within 30d</span>
            <Calendar className="h-3.5 w-3.5 text-indigo-400" />
          </div>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-zinc-50">
            {dueWithin30.length}
          </p>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span>Due Today / Overdue</span>
            <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
          </div>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-zinc-50">
            {urgentCount}
          </p>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span>Paused / Completed</span>
            <CheckCircle2 className="h-3.5 w-3.5 text-zinc-400" />
          </div>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-zinc-50">
            {closedCount}
          </p>
        </div>
      </div>

      {activeSentinels.length > 0 && (
        <div className="flex justify-end">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleExportAll}
            className="gap-2 border-zinc-800 bg-zinc-900/80 text-xs text-zinc-200 hover:bg-zinc-800 hover:text-white"
          >
            <Download className="h-3.5 w-3.5" />
            Export All Active (.ics)
          </Button>
        </div>
      )}
    </section>
  );
}
