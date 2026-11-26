"use client";

import { useRef, useState } from "react";
import { addDays, format } from "date-fns";
import {
  FileText,
  Sparkles,
  ArrowRight,
  Loader2,
  Mail,
  Smartphone,
  Link2,
} from "lucide-react";
import { toast } from "sonner";
import type { NotificationMethod, Sentinel } from "@/models/schema";
import { createSentinel } from "@/actions/sentinel.actions";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface CreateSentinelCardProps {
  userEmail: string;
  isPending: boolean;
  onStartTransition: (callback: () => Promise<void>) => void;
  onAddOptimistic: (sentinel: Sentinel) => void;
}

const LEAD_TIME_OPTIONS = [30, 14, 7, 0];

const CLAUSE_TEMPLATES = [
  {
    id: "termination",
    name: "Standard Termination",
    clause:
      "Tenant must provide written notice of termination no less than 90 days prior to the expiration date of December 31, 2026.",
  },
  {
    id: "renewal",
    name: "Renewal Option",
    clause:
      "Tenant shall have the option to renew this lease for an additional 3-year term, provided written notice is given 60 days before October 31, 2026.",
  },
  {
    id: "escalation",
    name: "Rent Escalation",
    clause:
      "Annual base rent shall increase by 3% on each anniversary of the commencement date, beginning January 1, 2027.",
  },
  {
    id: "insurance",
    name: "Insurance Certificate",
    clause:
      "Tenant must deliver an updated Certificate of Liability Insurance at least 15 days before policy expiration on August 15, 2026.",
  },
];

export function CreateSentinelCard({
  userEmail,
  isPending,
  onStartTransition,
  onAddOptimistic,
}: CreateSentinelCardProps) {
  const clauseRef = useRef<HTMLTextAreaElement>(null);
  const [propertyLabel, setPropertyLabel] = useState("");
  const [notificationMethod, setNotificationMethod] =
    useState<NotificationMethod>("email");
  const [emailTarget, setEmailTarget] = useState(userEmail);
  const [smsPhone, setSmsPhone] = useState("");
  const [webhookTarget, setWebhookTarget] = useState("");
  const [leadTimeDays, setLeadTimeDays] = useState<number[]>([30, 7, 0]);

  function getNotificationTarget(): string {
    switch (notificationMethod) {
      case "email":
        return emailTarget.trim();
      case "sms":
        return smsPhone.trim();
      case "slack":
      case "custom":
      default:
        return webhookTarget.trim();
    }
  }

  function handleTemplateClick(clause: string) {
    if (clauseRef.current) {
      clauseRef.current.value = clause;
      clauseRef.current.focus();
    }
  }

  function handleDemoFill() {
    const expirationDate = addDays(new Date(), 180);
    const formattedDate = format(expirationDate, "MMMM d, yyyy");
    const demoClause = `Tenant must provide written renewal notice 60 days prior to lease expiration on ${formattedDate}.`;
    if (clauseRef.current) {
      clauseRef.current.value = demoClause;
    }
  }

  function toggleLeadTime(day: number) {
    setLeadTimeDays((prev) => {
      const exists = prev.includes(day);
      const next = exists
        ? prev.filter((d) => d !== day)
        : [...prev, day].sort((a, b) => b - a);
      return next.length > 0 ? next : [0];
    });
  }

  async function handleSubmit(formData: FormData) {
    const clause = (formData.get("clause") as string) || "";
    const target = getNotificationTarget();

    if (!target) {
      toast.error("Please provide a notification destination");
      return;
    }

    const optimisticSentinel: Sentinel = {
      id: `temp-${Date.now()}`,
      userId: userEmail || "temp",
      eventName: "Analyzing clause...",
      propertyLabel: propertyLabel.trim() || undefined,
      triggerDate: new Date().toISOString().split("T")[0],
      originalClause: clause,
      notificationMethod,
      notificationTarget: target,
      status: "PENDING",
      leadTimeDays,
      notifiedWindows: [],
      createdAt: new Date(),
    };

    formData.set("propertyLabel", propertyLabel.trim());
    formData.set("notificationMethod", notificationMethod);
    formData.set("notificationTarget", target);
    formData.set("leadTimeDays", leadTimeDays.join(","));

    onStartTransition(async () => {
      onAddOptimistic(optimisticSentinel);
      const result = await createSentinel(null, formData);
      if (result.success) {
        toast.success(result.message);
        if (clauseRef.current) clauseRef.current.value = "";
        setPropertyLabel("");
        setSmsPhone("");
        setWebhookTarget("");
      } else {
        toast.error(result.message);
      }
    });
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <Card className="lg:col-span-2 bg-zinc-900/50 backdrop-blur-xl border-zinc-800">
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <div>
              <CardTitle className="text-zinc-50">Configure New Sentinel</CardTitle>
              <CardDescription className="text-zinc-400">
                Paste a single lease clause or upload a full PDF/DOCX document above.
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
              Sample Clause
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          <form action={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="propertyLabel" className="text-zinc-400">
                Property / Unit Label (optional)
              </Label>
              <Input
                id="propertyLabel"
                name="propertyLabel"
                value={propertyLabel}
                onChange={(e) => setPropertyLabel(e.target.value)}
                placeholder="e.g., 450 Market St, Suite 1200"
                className="bg-zinc-950/50 border-zinc-800 text-zinc-50 placeholder:text-zinc-600"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="clause" className="text-zinc-400">
                Lease Clause to Track
              </Label>
              <Textarea
                ref={clauseRef}
                id="clause"
                name="clause"
                placeholder="Paste the exact legal text here (e.g., Termination Option, Rent Escalation, Renewal Clause)..."
                required
                className="min-h-[150px] resize-none font-mono text-sm bg-zinc-950/50 border-zinc-800 text-zinc-50 placeholder:text-zinc-600 focus:border-zinc-600 focus:ring-zinc-500/20"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-zinc-400">Reminder Lead Times</Label>
              <div className="flex flex-wrap gap-2">
                {LEAD_TIME_OPTIONS.map((day) => {
                  const active = leadTimeDays.includes(day);
                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => toggleLeadTime(day)}
                      className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
                        active
                          ? "border-indigo-500/50 bg-indigo-500/20 text-indigo-200"
                          : "border-zinc-800 bg-zinc-950/50 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
                      }`}
                    >
                      {day === 0 ? "On due date" : `${day} days before`}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-zinc-400">Alert Destination</Label>

              <div className="flex gap-2 items-center">
                {notificationMethod === "email" ? (
                  <Input
                    type="email"
                    value={emailTarget}
                    onChange={(e) => setEmailTarget(e.target.value)}
                    placeholder="alerts@example.com"
                    className="flex-1 bg-zinc-950/50 border-zinc-800 text-zinc-50 placeholder:text-zinc-600"
                  />
                ) : notificationMethod === "sms" ? (
                  <Input
                    type="tel"
                    value={smsPhone}
                    onChange={(e) => setSmsPhone(e.target.value)}
                    placeholder="+14155552671"
                    className="flex-1 bg-zinc-950/50 border-zinc-800 text-zinc-50 placeholder:text-zinc-600"
                  />
                ) : (
                  <Input
                    type="url"
                    value={webhookTarget}
                    onChange={(e) => setWebhookTarget(e.target.value)}
                    placeholder="https://hooks.slack.com/services/..."
                    className="flex-1 bg-zinc-950/50 border-zinc-800 text-zinc-50 placeholder:text-zinc-600"
                  />
                )}

                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        size="icon"
                        aria-label="Email channel"
                        onClick={() => setNotificationMethod("email")}
                        className={`transition-colors ${
                          notificationMethod === "email"
                            ? "bg-indigo-600 hover:bg-indigo-500 text-white ring-2 ring-indigo-500/40"
                            : "bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white"
                        }`}
                      >
                        <Mail className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Direct Email (Resend)</p>
                    </TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        size="icon"
                        aria-label="Slack webhook channel"
                        onClick={() => setNotificationMethod("slack")}
                        className={`transition-colors ${
                          notificationMethod === "slack"
                            ? "bg-[#4A154B] hover:bg-[#5c1b5e] text-white ring-2 ring-[#4A154B]/50"
                            : "bg-zinc-800 hover:bg-[#4A154B] text-zinc-400 hover:text-white"
                        }`}
                      >
                        <svg className="h-4 w-4" viewBox="0 0 16 16" fill="currentColor">
                          <path d="M3.362 10.11c0 .926-.756 1.681-1.681 1.681S0 11.036 0 10.111.756 8.43 1.68 8.43h1.682zm.846 0c0-.924.756-1.68 1.681-1.68s1.681.756 1.681 1.68v4.21c0 .924-.756 1.68-1.68 1.68a1.685 1.685 0 0 1-1.682-1.68zM5.89 3.362c-.926 0-1.682-.756-1.682-1.681S4.964 0 5.89 0s1.68.756 1.68 1.68v1.682zm0 .846c.924 0 1.68.756 1.68 1.681S6.814 7.57 5.89 7.57H1.68C.757 7.57 0 6.814 0 5.89c0-.926.756-1.682 1.68-1.682zm6.749 1.682c0-.926.755-1.682 1.68-1.682S16 4.964 16 5.889s-.756 1.681-1.68 1.681h-1.681zm-.848 0c0 .924-.755 1.68-1.68 1.68A1.685 1.685 0 0 1 8.43 5.89V1.68C8.43.757 9.186 0 10.11 0c.926 0 1.681.756 1.681 1.68zm-1.681 6.748c.926 0 1.682.756 1.682 1.681S11.036 16 10.11 16s-1.681-.756-1.681-1.68v-1.682h1.68zm0-.847c-.924 0-1.68-.755-1.68-1.68s.756-1.681 1.68-1.681h4.21c.924 0 1.68.756 1.68 1.68 0 .926-.756 1.681-1.68 1.681z" />
                        </svg>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Slack Webhook (HTTPS)</p>
                    </TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        size="icon"
                        aria-label="SMS channel"
                        onClick={() => setNotificationMethod("sms")}
                        className={`transition-colors ${
                          notificationMethod === "sms"
                            ? "bg-emerald-600 hover:bg-emerald-500 text-white ring-2 ring-emerald-500/40"
                            : "bg-zinc-800 hover:bg-emerald-700 text-zinc-400 hover:text-white"
                        }`}
                      >
                        <Smartphone className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>SMS (E.164)</p>
                    </TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        size="icon"
                        aria-label="Custom webhook channel"
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
                    <TooltipContent>
                      <p>Custom Webhook (HTTPS)</p>
                    </TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="submit"
                        disabled={isPending}
                        size="icon"
                        aria-label="Activate Sentinel"
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
                {notificationMethod === "email"
                  ? "Delivered directly via Resend HTML email."
                  : notificationMethod === "sms"
                    ? "Use E.164 format (e.g., +14155552671)."
                    : "HTTPS endpoints only. Private network IPs are blocked."}
              </p>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="flex flex-col bg-zinc-900/50 backdrop-blur-xl border-zinc-800">
        <CardHeader>
          <CardTitle className="text-base text-zinc-50">Clause Templates</CardTitle>
          <CardDescription className="text-zinc-400">
            Click to load common commercial and residential lease clauses.
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
                <span className="text-sm font-medium text-zinc-300 group-hover:text-zinc-50">
                  {template.name}
                </span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
