"use client";

import { useMemo, useState } from "react";
import {
  Shield,
  Search,
  MoreHorizontal,
  Pencil,
  Pause,
  Play,
  CheckCircle2,
  Send,
  CalendarPlus,
  History,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import type { Sentinel, SentinelStatus } from "@/models/schema";
import {
  deleteSentinel,
  sendTestAlert,
  updateSentinelStatus,
} from "@/actions/sentinel.actions";
import { daysUntil, getTodayISO } from "@/lib/date-utils";
import { generateSentinelIcs } from "@/lib/ics";
import { triggerIcsDownload } from "@/components/dashboard/StatsBar";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface SentinelsTableProps {
  sentinels: Sentinel[];
  onEdit: (sentinel: Sentinel) => void;
  onViewLogs: (sentinel: Sentinel) => void;
}

type StatusFilter = "ALL" | SentinelStatus;

const STATUS_FILTERS: Array<{ value: StatusFilter; label: string }> = [
  { value: "ALL", label: "All" },
  { value: "PENDING", label: "Active" },
  { value: "PAUSED", label: "Paused" },
  { value: "FIRED", label: "Triggered" },
  { value: "RESOLVED", label: "Resolved" },
];

export function SentinelsTable({
  sentinels,
  onEdit,
  onViewLogs,
}: SentinelsTableProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [busyId, setBusyId] = useState<string | null>(null);
  const today = getTodayISO();

  const filteredSentinels = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return sentinels.filter((s) => {
      if (statusFilter !== "ALL" && s.status !== statusFilter) {
        return false;
      }
      if (!q) return true;
      return (
        s.eventName.toLowerCase().includes(q) ||
        (s.propertyLabel?.toLowerCase().includes(q) ?? false) ||
        s.originalClause.toLowerCase().includes(q) ||
        s.notificationTarget.toLowerCase().includes(q)
      );
    });
  }, [sentinels, searchQuery, statusFilter]);

  async function handleStatusChange(id: string, status: SentinelStatus) {
    setBusyId(id);
    const result = await updateSentinelStatus(id, status);
    if (result.success) {
      toast.success(result.message);
    } else {
      toast.error(result.message);
    }
    setBusyId(null);
  }

  async function handleSendTest(id: string) {
    setBusyId(id);
    const result = await sendTestAlert(id);
    if (result.success) {
      toast.success(result.message);
    } else {
      toast.error(result.message);
    }
    setBusyId(null);
  }

  async function handleDelete(id: string) {
    setBusyId(id);
    const result = await deleteSentinel(id);
    if (result.success) {
      toast.success("Monitor removed");
    } else {
      toast.error(result.message);
    }
    setBusyId(null);
  }

  function handleDownloadIcs(sentinel: Sentinel) {
    const ics = generateSentinelIcs(sentinel);
    const slug = sentinel.eventName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    triggerIcsDownload(ics, `${slug || "lease-deadline"}.ics`);
  }

  function renderStatusBadge(status: SentinelStatus) {
    switch (status) {
      case "PENDING":
        return (
          <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            Active
          </Badge>
        );
      case "PAUSED":
        return (
          <Badge className="bg-amber-500/10 text-amber-400 border border-amber-500/20">
            Paused
          </Badge>
        );
      case "FIRED":
        return (
          <Badge className="bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
            Triggered
          </Badge>
        );
      case "RESOLVED":
        return (
          <Badge className="bg-zinc-500/10 text-zinc-400 border border-zinc-700">
            Resolved
          </Badge>
        );
    }
  }

  function renderCountdownPill(sentinel: Sentinel) {
    if (sentinel.status === "RESOLVED" || sentinel.status === "FIRED") {
      return <span className="text-xs text-zinc-500">—</span>;
    }

    const diff = daysUntil(sentinel.triggerDate, today);
    if (diff < 0) {
      return (
        <Badge className="bg-rose-500/15 text-rose-400 border border-rose-500/30 tabular-nums">
          Overdue {Math.abs(diff)}d
        </Badge>
      );
    }
    if (diff === 0) {
      return (
        <Badge className="bg-amber-500/15 text-amber-300 border border-amber-500/30">
          Due today
        </Badge>
      );
    }
    if (diff <= 14) {
      return (
        <Badge className="bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 tabular-nums">
          In {diff}d
        </Badge>
      );
    }
    return (
      <span className="text-xs font-mono text-zinc-400 tabular-nums">
        In {diff}d
      </span>
    );
  }

  return (
    <Card className="bg-zinc-900/50 backdrop-blur-xl border-zinc-800">
      <CardHeader className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <CardTitle className="text-zinc-50">Tracked Lease Monitors</CardTitle>
            <CardDescription className="text-zinc-400">
              Search, filter, test notifications, inspect delivery logs, or export to calendar.
            </CardDescription>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-zinc-500" />
            <Input
              aria-label="Search monitors"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search deadline, property..."
              className="pl-8 h-9 bg-zinc-950/60 border-zinc-800 text-zinc-100 placeholder:text-zinc-500"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by status">
          {STATUS_FILTERS.map((filter) => {
            const count =
              filter.value === "ALL"
                ? sentinels.length
                : sentinels.filter((s) => s.status === filter.value).length;
            const active = statusFilter === filter.value;

            return (
              <button
                key={filter.value}
                type="button"
                onClick={() => setStatusFilter(filter.value)}
                className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
                  active
                    ? "border-zinc-500 bg-zinc-100 text-zinc-950"
                    : "border-zinc-800 bg-zinc-950/50 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
                }`}
              >
                {filter.label} <span className="tabular-nums opacity-70">({count})</span>
              </button>
            );
          })}
        </div>
      </CardHeader>

      <CardContent>
        {sentinels.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Shield className="h-12 w-12 text-zinc-700 mb-4" />
            <h3 className="font-medium text-zinc-400">No monitors active</h3>
            <p className="text-sm text-zinc-600 mt-1">
              Configure a sentinel above or upload a lease PDF/DOCX to start tracking deadlines.
            </p>
          </div>
        ) : filteredSentinels.length === 0 ? (
          <div className="py-12 text-center text-sm text-zinc-400">
            No monitors match your current filter.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-zinc-800 hover:bg-transparent">
                <TableHead className="text-zinc-400">Deadline</TableHead>
                <TableHead className="text-zinc-400">Channel</TableHead>
                <TableHead className="text-zinc-400">Status</TableHead>
                <TableHead className="text-zinc-400">Countdown</TableHead>
                <TableHead className="text-zinc-400">Trigger Date</TableHead>
                <TableHead className="text-right text-zinc-400">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSentinels.map((sentinel) => {
                const isBusy = Boolean(sentinel.id && busyId === sentinel.id);
                return (
                  <TableRow
                    key={sentinel.id}
                    className="border-zinc-800 hover:bg-zinc-800/30"
                  >
                    <TableCell className="max-w-[280px]">
                      <div className="font-medium text-zinc-50 truncate">
                        {sentinel.eventName}
                      </div>
                      {sentinel.propertyLabel && (
                        <div className="text-xs text-indigo-300/90 truncate">
                          {sentinel.propertyLabel}
                        </div>
                      )}
                      <div className="text-xs text-zinc-500 truncate mt-0.5">
                        {sentinel.originalClause.slice(0, 70)}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-zinc-300">
                      <span className="capitalize font-medium">
                        {sentinel.notificationMethod}
                      </span>
                      <div className="text-[11px] text-zinc-500 max-w-[160px] truncate">
                        {sentinel.notificationTarget}
                      </div>
                    </TableCell>
                    <TableCell>{renderStatusBadge(sentinel.status)}</TableCell>
                    <TableCell>{renderCountdownPill(sentinel)}</TableCell>
                    <TableCell className="font-mono text-xs text-zinc-300 tabular-nums">
                      {sentinel.triggerDate}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            disabled={!sentinel.id || isBusy}
                            aria-label={`Actions for ${sentinel.eventName}`}
                            className="text-zinc-400 hover:text-zinc-50 hover:bg-zinc-800"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="end"
                          className="w-48 bg-zinc-950 border-zinc-800 text-zinc-100"
                        >
                          <DropdownMenuItem onClick={() => onEdit(sentinel)}>
                            <Pencil className="h-4 w-4" />
                            Edit Sentinel
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => sentinel.id && handleSendTest(sentinel.id)}
                          >
                            <Send className="h-4 w-4" />
                            Send Test Alert
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onViewLogs(sentinel)}>
                            <History className="h-4 w-4" />
                            Delivery History
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDownloadIcs(sentinel)}>
                            <CalendarPlus className="h-4 w-4" />
                            Export .ics
                          </DropdownMenuItem>
                          <DropdownMenuSeparator className="bg-zinc-800" />
                          {sentinel.status === "PAUSED" ? (
                            <DropdownMenuItem
                              onClick={() =>
                                sentinel.id && handleStatusChange(sentinel.id, "PENDING")
                              }
                            >
                              <Play className="h-4 w-4" />
                              Resume Monitor
                            </DropdownMenuItem>
                          ) : sentinel.status === "PENDING" ? (
                            <DropdownMenuItem
                              onClick={() =>
                                sentinel.id && handleStatusChange(sentinel.id, "PAUSED")
                              }
                            >
                              <Pause className="h-4 w-4" />
                              Pause Monitor
                            </DropdownMenuItem>
                          ) : null}
                          {sentinel.status !== "RESOLVED" && (
                            <DropdownMenuItem
                              onClick={() =>
                                sentinel.id && handleStatusChange(sentinel.id, "RESOLVED")
                              }
                            >
                              <CheckCircle2 className="h-4 w-4" />
                              Mark Resolved
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator className="bg-zinc-800" />
                          <DropdownMenuItem
                            variant="destructive"
                            onClick={() => sentinel.id && handleDelete(sentinel.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
