"use client";

import { useOptimistic, useTransition, useRef, useState } from "react";
import Image from "next/image";
import { addDays, format } from "date-fns";
import { FileText, Sparkles, Shield, ArrowRight, Loader2, Mail, Smartphone, Link2 } from "lucide-react";
import { toast } from "sonner";

import { Sentinel, NotificationMethod } from "@/models/schema";
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
  
  // Notification method state
  const [notificationMethod, setNotificationMethod] = useState<NotificationMethod>("custom");
  const [smsPhone, setSmsPhone] = useState("");
  const [customWebhook, setCustomWebhook] = useState("");
  
  const [optimisticSentinels, addOptimistic] = useOptimistic<Sentinel[], Sentinel>(
    initialSentinels,
    (state, newSentinel) => [newSentinel, ...state]
  );

  const hasSentinels = optimisticSentinels.length > 0;

  // Determine notification target based on method
  function getNotificationTarget(): string {
    switch (notificationMethod) {
      case "slack":
      case "teams":
      case "email":
        return user.email || "";
      case "sms":
        return smsPhone;
      case "custom":
      default:
        return customWebhook;
    }
  }

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
    const target = getNotificationTarget();

    if (!target) {
      toast.error("Please provide a notification destination");
      return;
    }

    const optimisticSentinel: Sentinel = {
      id: `temp-${Date.now()}`,
      userId: user.email || "temp",
      eventName: "Analyzing...",
      triggerDate: new Date().toISOString().split("T")[0],
      originalClause: clause,
      notificationMethod: notificationMethod,
      notificationTarget: target,
      status: "PENDING",
      createdAt: new Date(),
    };

    // Add notification fields to formData
    formData.set("notificationMethod", notificationMethod);
    formData.set("notificationTarget", target);

    startTransition(async () => {
      addOptimistic(optimisticSentinel);
      const result = await createSentinel(null, formData);
      if (result.success) {
        toast.success(result.message);
        if (clauseRef.current) clauseRef.current.value = "";
        // Reset notification state
        setSmsPhone("");
        setCustomWebhook("");
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

              {/* Notification Method Selector - Single Row */}
              <div className="space-y-2">
                <Label className="text-zinc-400">Alert Destination</Label>
                
                <div className="flex gap-2 items-center">
                  {/* Conditional Input */}
                  {notificationMethod === "sms" ? (
                    <Input
                      type="tel"
                      value={smsPhone}
                      onChange={(e) => setSmsPhone(e.target.value)}
                      placeholder="Enter phone number (+1 555-123-4567)"
                      className="flex-1 bg-zinc-950/50 border-zinc-800 text-zinc-50 placeholder:text-zinc-600 focus:border-zinc-600 focus:ring-zinc-500/20"
                    />
                  ) : notificationMethod === "custom" ? (
                    <Input
                      type="url"
                      value={customWebhook}
                      onChange={(e) => setCustomWebhook(e.target.value)}
                      placeholder="https://hooks.slack.com/..."
                      className="flex-1 bg-zinc-950/50 border-zinc-800 text-zinc-50 placeholder:text-zinc-600 focus:border-zinc-600 focus:ring-zinc-500/20"
                    />
                  ) : (
                    <Input
                      disabled
                      value={`We'll use: ${user.email || "N/A"}`}
                      className="flex-1 bg-zinc-950/30 border-zinc-800 text-zinc-500 cursor-not-allowed"
                    />
                  )}

                  {/* Notification Method Icon Buttons - Brand Colors */}
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          size="icon"
                          onClick={() => setNotificationMethod("slack")}
                          className={`transition-colors ${
                            notificationMethod === "slack"
                              ? "bg-[#4A154B] hover:bg-[#5c1b5e] text-white ring-2 ring-[#4A154B]/50"
                              : "bg-zinc-800 hover:bg-[#4A154B] text-zinc-400 hover:text-white"
                          }`}
                        >
                          <svg className="h-4 w-4" viewBox="0 0 16 16" fill="currentColor">
                            <path d="M3.362 10.11c0 .926-.756 1.681-1.681 1.681S0 11.036 0 10.111.756 8.43 1.68 8.43h1.682zm.846 0c0-.924.756-1.68 1.681-1.68s1.681.756 1.681 1.68v4.21c0 .924-.756 1.68-1.68 1.68a1.685 1.685 0 0 1-1.682-1.68zM5.89 3.362c-.926 0-1.682-.756-1.682-1.681S4.964 0 5.89 0s1.68.756 1.68 1.68v1.682zm0 .846c.924 0 1.68.756 1.68 1.681S6.814 7.57 5.89 7.57H1.68C.757 7.57 0 6.814 0 5.89c0-.926.756-1.682 1.68-1.682zm6.749 1.682c0-.926.755-1.682 1.68-1.682S16 4.964 16 5.889s-.756 1.681-1.68 1.681h-1.681zm-.848 0c0 .924-.755 1.68-1.68 1.68A1.685 1.685 0 0 1 8.43 5.89V1.68C8.43.757 9.186 0 10.11 0c.926 0 1.681.756 1.681 1.68zm-1.681 6.748c.926 0 1.682.756 1.682 1.681S11.036 16 10.11 16s-1.681-.756-1.681-1.68v-1.682h1.68zm0-.847c-.924 0-1.68-.755-1.68-1.68s.756-1.681 1.68-1.681h4.21c.924 0 1.68.756 1.68 1.68 0 .926-.756 1.681-1.68 1.681z"/>
                          </svg>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent><p>Slack</p></TooltipContent>
                    </Tooltip>
                  </TooltipProvider>

                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          size="icon"
                          onClick={() => setNotificationMethod("teams")}
                          className={`transition-colors ${
                            notificationMethod === "teams"
                              ? "bg-[#5059C9] hover:bg-[#6068d4] text-white ring-2 ring-[#5059C9]/50"
                              : "bg-zinc-800 hover:bg-[#5059C9] text-zinc-400 hover:text-white"
                          }`}
                        >
                          <svg className="h-4 w-4" viewBox="0 0 16 16" fill="currentColor">
                            <path d="M9.186 4.797a2.42 2.42 0 1 0-2.86-2.448h1.178c.929 0 1.682.753 1.682 1.682zm-4.295 7.738h2.613c.929 0 1.682-.753 1.682-1.682V5.58h2.783a.7.7 0 0 1 .682.716v4.294a4.197 4.197 0 0 1-4.093 4.293c-1.618-.04-3-.99-3.667-2.35Zm10.737-9.372a1.674 1.674 0 1 1-3.349 0 1.674 1.674 0 0 1 3.349 0m-2.238 9.488-.12-.002a5.2 5.2 0 0 0 .381-2.07V6.306a1.7 1.7 0 0 0-.15-.725h1.792c.39 0 .707.317.707.707v3.765a2.6 2.6 0 0 1-2.598 2.598z"/>
                            <path d="M.682 3.349h6.822c.377 0 .682.305.682.682v6.822a.68.68 0 0 1-.682.682H.682A.68.68 0 0 1 0 10.853V4.03c0-.377.305-.682.682-.682Zm5.206 2.596v-.72h-3.59v.72h1.357V9.66h.87V5.945z"/>
                          </svg>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent><p>Teams</p></TooltipContent>
                    </Tooltip>
                  </TooltipProvider>

                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          size="icon"
                          onClick={() => setNotificationMethod("email")}
                          className={`transition-colors ${
                            notificationMethod === "email"
                              ? "bg-[#EA4335] hover:bg-[#ef5648] text-white ring-2 ring-[#EA4335]/50"
                              : "bg-zinc-800 hover:bg-[#EA4335] text-zinc-400 hover:text-white"
                          }`}
                        >
                          <Mail className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent><p>Email</p></TooltipContent>
                    </Tooltip>
                  </TooltipProvider>

                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          size="icon"
                          onClick={() => setNotificationMethod("sms")}
                          className={`transition-colors ${
                            notificationMethod === "sms"
                              ? "bg-[#1a9048] hover:bg-[#1fa855] text-white ring-2 ring-[#1a9048]/50"
                              : "bg-zinc-800 hover:bg-[#1a9048] text-zinc-400 hover:text-white"
                          }`}
                        >
                          <Smartphone className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent><p>SMS</p></TooltipContent>
                    </Tooltip>
                  </TooltipProvider>

                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          size="icon"
                          onClick={() => setNotificationMethod("custom")}
                          className={`transition-colors ${
                            notificationMethod === "custom"
                              ? "bg-zinc-600 hover:bg-zinc-500 text-white ring-2 ring-zinc-500/50"
                              : "bg-zinc-800 hover:bg-zinc-600 text-zinc-400 hover:text-white"
                          }`}
                        >
                          <Link2 className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent><p>Custom Webhook</p></TooltipContent>
                    </Tooltip>
                  </TooltipProvider>

                  {/* Submit Button */}
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button 
                          type="submit" 
                          disabled={isPending}
                          size="icon"
                          className="bg-zinc-50 hover:bg-white text-zinc-900 transition-colors"
                        >
                          {isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <ArrowRight className="h-4 w-4" />
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Activate Sentinel</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>

                <p className="text-xs text-zinc-500">
                  {notificationMethod === "custom" 
                    ? "Enter your webhook URL for direct integration."
                    : notificationMethod === "sms"
                    ? "Enter your phone number to receive SMS alerts."
                    : "Notifications will be sent via your connected account."}
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
                  className="w-full flex items-center gap-3 p-3 rounded-lg border border-transparent hover:border-zinc-700 hover:bg-zinc-800/50 transition-colors text-left group cursor-pointer"
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
                        onClick={() => sentinel.id && handleDelete(sentinel.id)}
                        disabled={!sentinel.id || deletingId === sentinel.id}
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
