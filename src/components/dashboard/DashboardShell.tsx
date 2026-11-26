"use client";

import { useOptimistic, useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import type { Sentinel } from "@/models/schema";
import { UserNav } from "@/components/dashboard/user-nav";
import { LeaseUploadDialog } from "@/components/dashboard/LeaseUploadDialog";
import { StatsBar } from "@/components/dashboard/StatsBar";
import { CreateSentinelCard } from "@/components/dashboard/CreateSentinelCard";
import { SentinelsTable } from "@/components/dashboard/SentinelsTable";
import { EditSentinelDialog } from "@/components/dashboard/EditSentinelDialog";
import { DeliveryLogsDrawer } from "@/components/dashboard/DeliveryLogsDrawer";
import { Button } from "@/components/ui/button";

interface User {
  name?: string | null;
  email?: string | null;
  image?: string | null;
}

interface DashboardShellProps {
  initialSentinels: Sentinel[];
  user: User;
}

export function DashboardShell({ initialSentinels, user }: DashboardShellProps) {
  const [isPending, startTransition] = useTransition();
  const [editingSentinel, setEditingSentinel] = useState<Sentinel | null>(null);
  const [logsSentinel, setLogsSentinel] = useState<Sentinel | null>(null);

  const [optimisticSentinels, addOptimistic] = useOptimistic<Sentinel[], Sentinel>(
    initialSentinels,
    (state, newSentinel) => [newSentinel, ...state]
  );

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Image
            src="/logo_white.svg"
            alt="LeaseSentinel"
            width={32}
            height={32}
          />
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-zinc-50">
              LeaseSentinel
            </h1>
            <p className="text-sm text-zinc-400">
              Configure and monitor your lease deadlines.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <LeaseUploadDialog defaultEmail={user.email || ""} />
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="text-zinc-400 hover:text-zinc-50 hover:bg-zinc-900"
          >
            <Link href="/demo">Demo</Link>
          </Button>
          <span className="text-sm text-zinc-400 hidden sm:block">
            {user.name || user.email}
          </span>
          <UserNav user={user} />
        </div>
      </header>

      <StatsBar sentinels={optimisticSentinels} />

      <CreateSentinelCard
        userEmail={user.email || ""}
        isPending={isPending}
        onStartTransition={(cb) => startTransition(cb)}
        onAddOptimistic={addOptimistic}
      />

      <SentinelsTable
        sentinels={optimisticSentinels}
        onEdit={(sentinel) => setEditingSentinel(sentinel)}
        onViewLogs={(sentinel) => setLogsSentinel(sentinel)}
      />

      <EditSentinelDialog
        key={editingSentinel?.id ?? "none"}
        sentinel={editingSentinel}
        open={Boolean(editingSentinel)}
        onOpenChange={(open) => {
          if (!open) setEditingSentinel(null);
        }}
      />

      <DeliveryLogsDrawer
        sentinel={logsSentinel}
        open={Boolean(logsSentinel)}
        onOpenChange={(open) => {
          if (!open) setLogsSentinel(null);
        }}
      />
    </div>
  );
}
