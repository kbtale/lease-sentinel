"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, XCircle, Loader2, History } from "lucide-react";
import type { LogEntry, Sentinel } from "@/models/schema";
import { getSentinelLogs } from "@/actions/fetch-actions";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

interface DeliveryLogsDrawerProps {
  sentinel: Sentinel | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface LoadedLogsState {
  sentinelId: string;
  entries: LogEntry[];
}

export function DeliveryLogsDrawer({
  sentinel,
  open,
  onOpenChange,
}: DeliveryLogsDrawerProps) {
  const [loaded, setLoaded] = useState<LoadedLogsState | null>(null);
  const activeId = open ? sentinel?.id ?? null : null;

  useEffect(() => {
    if (!activeId) return;
    let cancelled = false;

    getSentinelLogs(activeId).then((entries) => {
      if (!cancelled) {
        setLoaded({ sentinelId: activeId, entries });
      }
    });

    return () => {
      cancelled = true;
    };
  }, [activeId]);

  const isLoading = Boolean(activeId && loaded?.sentinelId !== activeId);
  const logs = activeId && loaded?.sentinelId === activeId ? loaded.entries : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="left-auto right-0 top-0 bottom-0 h-full max-h-none max-w-md translate-x-0 translate-y-0 rounded-none border-l border-y-0 border-r-0 border-zinc-800 bg-zinc-950">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-4 w-4 text-indigo-400" />
            Delivery History
          </DialogTitle>
          <DialogDescription>
            {sentinel ? `${sentinel.eventName} (${sentinel.triggerDate})` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 space-y-3 overflow-y-auto pr-1">
          {isLoading ? (
            <div className="flex items-center justify-center py-12 text-zinc-400 gap-2 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading delivery logs...
            </div>
          ) : logs.length === 0 ? (
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-6 text-center text-sm text-zinc-400">
              No delivery attempts recorded for this sentinel yet. Send a test alert to verify your destination.
            </div>
          ) : (
            logs.map((entry) => {
              const isSuccess = entry.status === "SUCCESS";
              const method = String(entry.payload?.method || "unknown");
              const provider = entry.payload?.provider
                ? String(entry.payload.provider)
                : null;
              const isTest = Boolean(entry.payload?.isTest);
              const errorText = entry.payload?.error
                ? String(entry.payload.error)
                : null;

              return (
                <div
                  key={entry.id || entry.firedAt}
                  className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-3.5 space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {isSuccess ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                      ) : (
                        <XCircle className="h-4 w-4 text-rose-400" />
                      )}
                      <Badge
                        className={
                          isSuccess
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                            : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                        }
                      >
                        {entry.status}
                      </Badge>
                      {isTest && (
                        <Badge
                          variant="outline"
                          className="border-indigo-500/30 text-indigo-300 text-[10px]"
                        >
                          TEST
                        </Badge>
                      )}
                    </div>
                    <span className="font-mono text-[11px] text-zinc-500">
                      {new Date(entry.firedAt).toLocaleString()}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-zinc-300">
                    <span className="uppercase tracking-wide text-zinc-500">Channel:</span>
                    <span className="font-medium capitalize">{method}</span>
                    {provider && (
                      <span className="text-zinc-500">via {provider}</span>
                    )}
                  </div>

                  {errorText && (
                    <p className="rounded bg-rose-950/50 border border-rose-900/60 px-2.5 py-1.5 text-xs text-rose-300">
                      {errorText}
                    </p>
                  )}
                </div>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
