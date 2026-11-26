"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Sparkles,
  Upload,
  CalendarPlus,
  Download,
  ArrowRight,
  Loader2,
  Mail,
  Webhook,
  FileText,
} from "lucide-react";
import type { ExtractedDeadline } from "@/models/schema";
import { daysUntil, getTodayISO } from "@/lib/date-utils";
import { generateBulkIcs, generateSentinelIcs } from "@/lib/ics";
import { triggerIcsDownload } from "@/components/dashboard/StatsBar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const SAMPLE_LEASES = [
  {
    id: "commercial",
    title: "Commercial Office Lease (3 Deadlines)",
    property: "450 Market St, Suite 1200",
    text: `SECTION 4.2 RENEWAL OPTION: Tenant shall have one (1) option to renew this Lease for an additional five-year term, provided Tenant delivers written renewal notice to Landlord at least 90 days prior to December 31, 2026.

SECTION 5.1 RENT ESCALATION: Commencing on January 1, 2027, Base Rent shall automatically increase by 3.5% over the prior lease year.

SECTION 9.3 INSURANCE CERTIFICATE: Tenant must deliver a renewed Certificate of Commercial General Liability Insurance at least 15 days prior to August 15, 2026.`,
  },
  {
    id: "residential",
    title: "Residential Renewal & Termination",
    property: "88 Pine St, Apt 4B",
    text: `NOTICE TO VACATE: Tenant must submit written notice of non-renewal no less than 60 days prior to the lease expiration date of November 30, 2026, otherwise the tenancy converts to month-to-month.

PRE-MOVE-OUT INSPECTION: Landlord and Tenant shall complete the walkthrough inspection on or before November 20, 2026.`,
  },
  {
    id: "retail",
    title: "Retail Space Escalation & Deposit",
    property: "1200 Broadway, Unit 1A",
    text: `EARLY TERMINATION CLAUSE: Tenant may exercise its one-time early break option by delivering written termination notice 120 days prior to October 31, 2027.

SECURITY DEPOSIT ADJUSTMENT: Additional security deposit installment is due on September 1, 2026.`,
  },
];

export function DemoPlayground() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [leaseText, setLeaseText] = useState(SAMPLE_LEASES[0].text);
  const [propertyLabel, setPropertyLabel] = useState(SAMPLE_LEASES[0].property);
  const [deadlines, setDeadlines] = useState<ExtractedDeadline[]>([]);
  const [extractionMode, setExtractionMode] = useState<"ai" | "sample" | null>(null);
  const [previewTab, setPreviewTab] = useState<"webhook" | "email">("webhook");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const today = getTodayISO();

  async function handleExtractText() {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const response = await fetch("/api/demo/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: leaseText }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        setErrorMessage(data.message || "Extraction failed");
        return;
      }
      setDeadlines(data.deadlines || []);
      setExtractionMode(data.mode || "sample");
    } catch {
      setErrorMessage("Network error while analyzing lease text.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleFileUpload(file: File | undefined) {
    if (!file) return;
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/demo/extract", {
        method: "POST",
        body: formData,
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        setErrorMessage(data.message || "File analysis failed");
        return;
      }
      setDeadlines(data.deadlines || []);
      setExtractionMode(data.mode || "sample");
      setPropertyLabel(file.name.replace(/\.[^.]+$/, ""));
    } catch {
      setErrorMessage("Network error while uploading lease file.");
    } finally {
      setIsLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function handleExportSingle(item: ExtractedDeadline, index: number) {
    const ics = generateSentinelIcs({
      id: `demo-${index}`,
      eventName: item.eventName,
      triggerDate: item.triggerDate,
      originalClause: item.sourceQuote,
      propertyLabel,
      leadTimeDays: item.suggestedLeadDays,
    });
    triggerIcsDownload(ics, `demo-deadline-${index + 1}.ics`);
  }

  function handleExportAll() {
    if (deadlines.length === 0) return;
    const ics = generateBulkIcs(
      deadlines.map((item, idx) => ({
        id: `demo-${idx}`,
        eventName: item.eventName,
        triggerDate: item.triggerDate,
        originalClause: item.sourceQuote,
        propertyLabel,
        leadTimeDays: item.suggestedLeadDays,
      }))
    );
    triggerIcsDownload(ics, "leasesentinel-demo-deadlines.ics");
  }

  const firstDeadline = deadlines[0];
  const sampleWebhookPayload = firstDeadline
    ? JSON.stringify(
        {
          event: firstDeadline.eventName,
          date: firstDeadline.triggerDate,
          property: propertyLabel,
          clause: firstDeadline.sourceQuote,
          windowDays: firstDeadline.suggestedLeadDays[0] ?? 30,
          isTest: false,
        },
        null,
        2
      )
    : null;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50">
      <div className="max-w-6xl mx-auto px-4 py-10 space-y-8">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-800/80 pb-6">
          <div className="flex items-center gap-3">
            <Image src="/logo_white.svg" alt="LeaseSentinel" width={36} height={36} />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-semibold tracking-tight">LeaseSentinel</h1>
                <Badge className="bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                  Interactive Demo
                </Badge>
              </div>
              <p className="text-sm text-zinc-400">
                Test lease deadline extraction, calendar export, and alert payloads without signing in.
              </p>
            </div>
          </div>

          <Button asChild className="bg-zinc-100 text-zinc-950 hover:bg-white gap-2">
            <Link href="/login">
              Sign in to Save &amp; Monitor
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 space-y-4">
            <Card className="bg-zinc-900/60 border-zinc-800">
              <CardHeader>
                <CardTitle className="text-base text-zinc-50">1. Choose or Upload a Lease</CardTitle>
                <CardDescription className="text-zinc-400">
                  Load a sample agreement, paste clauses, or test a .pdf / .docx / .txt file (read-only, nothing saved).
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  {SAMPLE_LEASES.map((sample) => (
                    <button
                      key={sample.id}
                      type="button"
                      onClick={() => {
                        setLeaseText(sample.text);
                        setPropertyLabel(sample.property);
                      }}
                      className="w-full flex items-center gap-2.5 rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2.5 text-left text-xs text-zinc-200 hover:border-zinc-700 hover:bg-zinc-900 transition-colors cursor-pointer"
                    >
                      <FileText className="h-4 w-4 text-indigo-400 shrink-0" />
                      <div>
                        <div className="font-medium">{sample.title}</div>
                        <div className="text-zinc-500">{sample.property}</div>
                      </div>
                    </button>
                  ))}
                </div>

                <Textarea
                  aria-label="Demo lease text"
                  value={leaseText}
                  onChange={(e) => setLeaseText(e.target.value)}
                  className="min-h-[210px] font-mono text-xs bg-zinc-950 border-zinc-800 text-zinc-100"
                />

                {errorMessage && (
                  <div
                    role="alert"
                    className="rounded-md border border-rose-500/40 bg-rose-950/40 px-3 py-2 text-xs text-rose-300"
                  >
                    {errorMessage}
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    disabled={isLoading}
                    onClick={handleExtractText}
                    className="flex-1 gap-2 bg-zinc-100 text-zinc-950 hover:bg-white"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Analyzing...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4" />
                        Extract Deadlines
                      </>
                    )}
                  </Button>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.docx,.txt"
                    className="hidden"
                    onChange={(e) => handleFileUpload(e.target.files?.[0])}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    disabled={isLoading}
                    onClick={() => fileInputRef.current?.click()}
                    className="gap-2 border-zinc-700 bg-zinc-900 text-zinc-100 hover:bg-zinc-800"
                  >
                    <Upload className="h-4 w-4" />
                    PDF / DOCX
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-7 space-y-4">
            <Card className="bg-zinc-900/60 border-zinc-800">
              <CardHeader className="flex flex-row items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-base text-zinc-50">
                    2. Extracted Deadlines &amp; Calendar Export
                  </CardTitle>
                  <CardDescription className="text-zinc-400">
                    {extractionMode === "ai"
                      ? "Extracted live with Gemini structured output."
                      : extractionMode === "sample"
                        ? "Extracted with built-in demo parser."
                        : "Run extraction on the left to preview structured deadlines."}
                  </CardDescription>
                </div>
                {deadlines.length > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleExportAll}
                    className="gap-1.5 border-zinc-700 bg-zinc-950 text-xs text-zinc-200 hover:bg-zinc-800"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Export All (.ics)
                  </Button>
                )}
              </CardHeader>

              <CardContent>
                {deadlines.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-zinc-800 py-14 text-center text-sm text-zinc-500">
                    Click <strong className="text-zinc-300">Extract Deadlines</strong> to see every renewal, escalation, and notice cutoff parsed into structured alerts.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {deadlines.map((item, idx) => {
                      const diff = daysUntil(item.triggerDate, today);
                      return (
                        <div
                          key={`${item.eventName}-${idx}`}
                          className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-4 space-y-2"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-zinc-100">
                                {item.eventName}
                              </span>
                              <Badge
                                variant="outline"
                                className="capitalize border-zinc-700 text-zinc-300 text-[11px]"
                              >
                                {item.category}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge className="bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 font-mono tabular-nums">
                                {item.triggerDate} ({diff >= 0 ? `In ${diff}d` : `${Math.abs(diff)}d ago`})
                              </Badge>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => handleExportSingle(item, idx)}
                                className="h-7 px-2 text-xs text-zinc-300 hover:text-white hover:bg-zinc-800 gap-1"
                              >
                                <CalendarPlus className="h-3.5 w-3.5" />
                                .ics
                              </Button>
                            </div>
                          </div>
                          <p className="text-xs text-zinc-400 italic">
                            &ldquo;{item.sourceQuote}&rdquo;
                          </p>
                          <div className="flex items-center gap-2 text-[11px] text-zinc-500">
                            <span>Suggested reminders:</span>
                            {item.suggestedLeadDays.map((d) => (
                              <span
                                key={d}
                                className="rounded bg-zinc-900 border border-zinc-800 px-1.5 py-0.5 text-zinc-300"
                              >
                                {d === 0 ? "Due day" : `${d}d before`}
                              </span>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {firstDeadline && (
              <Card className="bg-zinc-900/60 border-zinc-800">
                <CardHeader className="flex flex-row items-center justify-between gap-2">
                  <div>
                    <CardTitle className="text-base text-zinc-50">
                      3. Alert Payload Preview
                    </CardTitle>
                    <CardDescription className="text-zinc-400">
                      Inspect the signed webhook JSON or direct Resend HTML email sent when a deadline triggers.
                    </CardDescription>
                  </div>
                  <div className="flex gap-1.5">
                    <Button
                      type="button"
                      size="sm"
                      variant={previewTab === "webhook" ? "default" : "outline"}
                      onClick={() => setPreviewTab("webhook")}
                      className={
                        previewTab === "webhook"
                          ? "bg-zinc-100 text-zinc-950 gap-1.5"
                          : "border-zinc-800 bg-zinc-950 text-zinc-300 gap-1.5"
                      }
                    >
                      <Webhook className="h-3.5 w-3.5" />
                      Webhook JSON
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={previewTab === "email" ? "default" : "outline"}
                      onClick={() => setPreviewTab("email")}
                      className={
                        previewTab === "email"
                          ? "bg-zinc-100 text-zinc-950 gap-1.5"
                          : "border-zinc-800 bg-zinc-950 text-zinc-300 gap-1.5"
                      }
                    >
                      <Mail className="h-3.5 w-3.5" />
                      Resend Email
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {previewTab === "webhook" ? (
                    <div className="space-y-2">
                      <div className="text-[11px] font-mono text-zinc-400">
                        X-LeaseSentinel-Signature: sha256=&lt;hmac-sha256-hex&gt;
                      </div>
                      <pre className="rounded-lg border border-zinc-800 bg-zinc-950 p-4 text-xs font-mono text-emerald-300 overflow-x-auto">
                        {sampleWebhookPayload}
                      </pre>
                    </div>
                  ) : (
                    <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-5 space-y-3">
                      <div className="text-xs text-zinc-500">
                        Subject:{" "}
                        <span className="text-zinc-200 font-medium">
                          [30-day reminder] {firstDeadline.eventName} ({firstDeadline.triggerDate})
                        </span>
                      </div>
                      <div className="border-t border-zinc-800 pt-3 space-y-2">
                        <Badge className="bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                          30-day reminder
                        </Badge>
                        <h3 className="text-lg font-semibold text-zinc-50">
                          {firstDeadline.eventName}
                        </h3>
                        <p className="text-xs text-zinc-400">
                          Property: <span className="text-zinc-200">{propertyLabel}</span> · Trigger Date:{" "}
                          <span className="font-mono text-zinc-200">{firstDeadline.triggerDate}</span>
                        </p>
                        <div className="rounded border border-zinc-800 bg-zinc-900/60 p-3 text-xs text-zinc-300">
                          {firstDeadline.sourceQuote}
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
