"use client";

import { useOptimistic, useTransition, useRef, useState } from "react";
import Image from "next/image";
import { addDays, format } from "date-fns";
import { FileText, Sparkles, Shield, ArrowRight, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Sentinel } from "@/models/schema";
import { createSentinel, deleteSentinel } from "@/actions/sentinel.actions";
import { UserNav } from "@/components/dashboard/user-nav";

import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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
// Template Data
// ============================================================================

const CLAUSE_TEMPLATES = [
  {
    id: "termination",
    name: "Standard Termination",
    clause: "Tenant must provide written notice of termination no less than 90 days prior to the expiration date of this lease agreement.",
  },
  {
    id: "renewal",
    name: "Renewal Option",
    clause: "Tenant shall have the option to renew this lease for an additional term, provided written notice is given 60 days before expiration.",
  },
  {
    id: "escalation",
    name: "Rent Escalation",
    clause: "Annual rent shall increase by 3% on each anniversary of the commencement date, beginning January 1st of the following year.",
  },
  {
    id: "force-majeure",
    name: "Force Majeure",
    clause: "In the event of force majeure, either party may terminate with 30 days written notice following the cessation of the force majeure event.",
  },
];

// ============================================================================
// Component
// ============================================================================

export function DashboardShell({ initialSentinels, user }: DashboardShellProps) {
  const clauseRef = useRef<HTMLTextAreaElement>(null);
  const [isPending, startTransition] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  
  const [optimisticSentinels, addOptimistic] = useOptimistic<Sentinel[], Sentinel>(
    initialSentinels,
    (state, newSentinel) => [newSentinel, ...state]
  );

  const hasSentinels = optimisticSentinels.length > 0;

  // Fill textarea with template
  function handleTemplateClick(clause: string) {
    if (clauseRef.current) {
      clauseRef.current.value = clause;
      clauseRef.current.focus();
    }
  }

  // Demo data fill
  function handleDemoFill() {
    const expirationDate = addDays(new Date(), 180);
    const formattedDate = format(expirationDate, "MMMM d, yyyy");
    const demoClause = `Tenant must provide notice 180 days prior to expiration on ${formattedDate}.`;
    if (clauseRef.current) {
      clauseRef.current.value = demoClause;
    }
  }

  // Form submission
  async function handleSubmit(formData: FormData) {
    const clause = formData.get("clause") as string;
    const webhookUrl = formData.get("webhookUrl") as string;

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
        if (clauseRef.current) clauseRef.current.value = "";
      } else {
        toast.error(result.message);
      }
    });
  }

  // Delete sentinel
  async function handleDelete(id: string) {
    setDeletingId(id);
    const result = await deleteSentinel(id);
    if (result.success) {
      toast.success("Monitor removed");
    } else {
      toast.error(result.message);
    }
    setDeletingId(null);
  }

  // Status badge styling - premium dark mode
  function getStatusBadge(status: string) {
    switch (status) {
      case "PENDING":
        return (
          <Badge className="bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 hover:bg-emerald-500/20">
            Active
          </Badge>
        );
      case "FIRED":
        return (
          <Badge className="bg-zinc-500/10 text-zinc-400 border border-zinc-500/20 hover:bg-zinc-500/20">
            Triggered
          </Badge>
        );
      default:
        return (
          <Badge className="bg-rose-500/10 text-rose-500 border border-rose-500/20 hover:bg-rose-500/20">
            Error
          </Badge>
        );
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="flex items-center justify-between">
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
        <div className="flex items-center gap-3">
          <span className="text-sm text-zinc-400 hidden sm:block">
            {user.name || user.email}
          </span>
          <UserNav user={user} />
        </div>
      </header>

      {/* Configuration Grid: Form + Templates */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: New Monitor Form (Span 2) */}
        <Card className="lg:col-span-2 bg-zinc-900/50 backdrop-blur-xl border-zinc-800">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-zinc-50">Configure New Sentinel</CardTitle>
                <CardDescription className="text-zinc-400">
                  Paste lease text and we&apos;ll extract the deadline automatically.
                </CardDescription>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleDemoFill}
                className="h-8 text-xs gap-1.5 text-zinc-400 hover:text-zinc-50 hover:bg-zinc-800"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Demo Data
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <form action={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="clause" className="text-zinc-400">Lease Clause to Track</Label>
                <Textarea
                  ref={clauseRef}
                  id="clause"
                  name="clause"
                  placeholder="Paste the exact legal text here (e.g., Termination Option, Rent Escalation, Renewal Clause)..."
                  required
                  className="min-h-[200px] resize-none font-mono text-sm bg-zinc-950/50 border-zinc-800 text-zinc-50 placeholder:text-zinc-600 focus:border-zinc-600 focus:ring-zinc-500/20"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="webhookUrl" className="text-zinc-400">Alert Destination</Label>
                <div className="flex gap-2">
                  <Input
                    id="webhookUrl"
                    name="webhookUrl"
                    type="url"
                    placeholder="https://hooks.slack.com/... or your-email@company.com"
                    required
                    className="flex-1 bg-zinc-950/50 border-zinc-800 text-zinc-50 placeholder:text-zinc-600 focus:border-zinc-600 focus:ring-zinc-500/20"
                  />
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button 
                          type="submit" 
                          disabled={isPending}
                          size="icon"
                          className="bg-zinc-800 hover:bg-zinc-700 text-zinc-50 border-zinc-700 transition-colors"
                        >
                          {isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <ArrowRight className="h-4 w-4" />
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        <p>Activate Sentinel</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <p className="text-xs text-zinc-500">
                  Where notifications will be sent when the deadline approaches.
                </p>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Right: Template Library (Span 1) */}
        <Card className="flex flex-col bg-zinc-900/50 backdrop-blur-xl border-zinc-800">
          <CardHeader>
            <CardTitle className="text-base text-zinc-50">Clause Templates</CardTitle>
            <CardDescription className="text-zinc-400">
              Click to auto-fill common lease clauses.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-1">
            <div className="space-y-2">
              {CLAUSE_TEMPLATES.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => handleTemplateClick(template.clause)}
                  className="w-full flex items-center gap-3 p-3 rounded-lg border border-transparent hover:border-zinc-700 hover:bg-zinc-800/50 transition-colors text-left group"
                >
                  <FileText className="h-4 w-4 text-zinc-500 group-hover:text-zinc-50 transition-colors" />
                  <span className="text-sm font-medium text-zinc-300 group-hover:text-zinc-50">{template.name}</span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bottom: Active Monitors Table */}
      <Card className="bg-zinc-900/50 backdrop-blur-xl border-zinc-800">
        <CardHeader>
          <CardTitle className="text-zinc-50">Active Monitors</CardTitle>
          <CardDescription className="text-zinc-400">
            All your tracked lease deadlines in one place.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {hasSentinels ? (
            <Table>
              <TableHeader>
                <TableRow className="border-zinc-800 hover:bg-transparent">
                  <TableHead className="w-[200px] text-zinc-400">Name</TableHead>
                  <TableHead className="text-zinc-400">Clause Preview</TableHead>
                  <TableHead className="w-[100px] text-zinc-400">Status</TableHead>
                  <TableHead className="w-[120px] text-zinc-400">Trigger Date</TableHead>
                  <TableHead className="w-[100px] text-right text-zinc-400">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {optimisticSentinels.map((sentinel) => (
                  <TableRow key={sentinel.id} className="border-zinc-800 hover:bg-zinc-800/30">
                    <TableCell className="font-medium text-zinc-50">
                      {sentinel.eventName}
                    </TableCell>
                    <TableCell className="text-zinc-500 text-sm max-w-[300px] truncate">
                      {sentinel.originalClause.slice(0, 60)}...
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(sentinel.status)}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-zinc-400">
                      {sentinel.triggerDate}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(sentinel.id)}
                        disabled={deletingId === sentinel.id}
                        className="text-rose-500 hover:text-rose-400 hover:bg-rose-500/10"
                      >
                        {deletingId === sentinel.id ? "..." : "Remove"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Shield className="h-12 w-12 text-zinc-700 mb-4" />
              <h3 className="font-medium text-zinc-400">
                No monitors active
              </h3>
              <p className="text-sm text-zinc-600 mt-1">
                Configure a sentinel above to start tracking lease deadlines.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
