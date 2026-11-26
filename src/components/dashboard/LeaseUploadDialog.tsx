"use client";

import { useRef, useState, useTransition } from "react";
import { Upload, FileText, Loader2, CheckSquare, Square, Sparkles } from "lucide-react";
import { toast } from "sonner";
import {
  extractLeaseDocumentAction,
  createSentinelsBatch,
} from "@/actions/sentinel.actions";
import type {
  BatchSentinelItem,
  DeadlineCategory,
  NotificationMethod,
} from "@/models/schema";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

interface ReviewDraft {
  id: string;
  selected: boolean;
  eventName: string;
  triggerDate: string;
  category: DeadlineCategory;
  sourceQuote: string;
  leadTimeDays: number[];
  notificationMethod: NotificationMethod;
  notificationTarget: string;
}

interface LeaseUploadDialogProps {
  defaultEmail: string;
  triggerLabel?: string;
}

const LEAD_TIME_OPTIONS = [30, 14, 7, 0];

export function LeaseUploadDialog({
  defaultEmail,
  triggerLabel = "Upload Lease PDF / DOCX",
}: LeaseUploadDialogProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"file" | "paste">("file");
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [pastedText, setPastedText] = useState("");
  const [propertyLabel, setPropertyLabel] = useState("");
  const [drafts, setDrafts] = useState<ReviewDraft[]>([]);
  const [step, setStep] = useState<"upload" | "review">("upload");
  const [isExtracting, startExtract] = useTransition();
  const [isSaving, startSave] = useTransition();

  function resetDialog() {
    setSelectedFile(null);
    setPastedText("");
    setPropertyLabel("");
    setDrafts([]);
    setStep("upload");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function handleFileSelected(file: File | undefined) {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error("File exceeds 10MB limit.");
      return;
    }
    setSelectedFile(file);
  }

  function handleExtract() {
    const formData = new FormData();
    if (mode === "file") {
      if (!selectedFile) {
        toast.error("Please choose a .pdf, .docx, or .txt lease file.");
        return;
      }
      formData.append("file", selectedFile);
    } else {
      if (pastedText.trim().length < 20) {
        toast.error("Please paste at least 20 characters of lease text.");
        return;
      }
      formData.append("text", pastedText);
    }

    startExtract(async () => {
      const result = await extractLeaseDocumentAction(formData);
      if (!result.success || !result.data) {
        toast.error(result.message);
        return;
      }

      if (result.data.deadlines.length === 0) {
        toast.error("No concrete deadlines were found in that document.");
        return;
      }

      setDrafts(
        result.data.deadlines.map((item, idx) => ({
          id: `draft-${idx}-${Date.now()}`,
          selected: true,
          eventName: item.eventName,
          triggerDate: item.triggerDate,
          category: item.category,
          sourceQuote: item.sourceQuote,
          leadTimeDays: item.suggestedLeadDays.length > 0 ? item.suggestedLeadDays : [30, 7, 0],
          notificationMethod: "email",
          notificationTarget: defaultEmail,
        }))
      );
      setStep("review");
      toast.success(`Extracted ${result.data.deadlines.length} deadlines for review.`);
    });
  }

  function updateDraft(id: string, patch: Partial<ReviewDraft>) {
    setDrafts((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...patch } : item))
    );
  }

  function toggleLeadTime(id: string, day: number) {
    setDrafts((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const exists = item.leadTimeDays.includes(day);
        const next = exists
          ? item.leadTimeDays.filter((d) => d !== day)
          : [...item.leadTimeDays, day].sort((a, b) => b - a);
        return { ...item, leadTimeDays: next.length > 0 ? next : [0] };
      })
    );
  }

  function handleSaveSelected() {
    const chosen = drafts.filter((d) => d.selected);
    if (chosen.length === 0) {
      toast.error("Select at least one deadline to save.");
      return;
    }

    const payload: BatchSentinelItem[] = chosen.map((item) => ({
      eventName: item.eventName,
      propertyLabel: propertyLabel.trim() || undefined,
      triggerDate: item.triggerDate,
      originalClause: item.sourceQuote,
      notificationMethod: item.notificationMethod,
      notificationTarget: item.notificationTarget,
      leadTimeDays: item.leadTimeDays,
    }));

    startSave(async () => {
      const result = await createSentinelsBatch(payload);
      if (result.success) {
        toast.success(result.message);
        resetDialog();
        setOpen(false);
      } else {
        toast.error(result.message);
      }
    });
  }

  const selectedCount = drafts.filter((d) => d.selected).length;

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) {
          resetDialog();
        }
      }}
    >
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-2 border-zinc-700 bg-zinc-900 text-zinc-100 hover:bg-zinc-800 hover:text-white"
        >
          <Upload className="h-4 w-4" />
          {triggerLabel}
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {step === "upload" ? "Upload Lease Document" : "Review Extracted Deadlines"}
          </DialogTitle>
          <DialogDescription>
            {step === "upload"
              ? "Upload a PDF, DOCX, or TXT lease (up to 10MB) or paste full lease text to extract every key deadline at once."
              : "Toggle, edit dates, or customize alert channels before creating your sentinels."}
          </DialogDescription>
        </DialogHeader>

        {step === "upload" ? (
          <div className="space-y-4">
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant={mode === "file" ? "default" : "outline"}
                onClick={() => setMode("file")}
                className={
                  mode === "file"
                    ? "bg-zinc-100 text-zinc-950 hover:bg-white"
                    : "border-zinc-800 bg-zinc-900 text-zinc-300"
                }
              >
                Upload File
              </Button>
              <Button
                type="button"
                size="sm"
                variant={mode === "paste" ? "default" : "outline"}
                onClick={() => setMode("paste")}
                className={
                  mode === "paste"
                    ? "bg-zinc-100 text-zinc-950 hover:bg-white"
                    : "border-zinc-800 bg-zinc-900 text-zinc-300"
                }
              >
                Paste Full Text
              </Button>
            </div>

            <div className="space-y-2">
              <Label htmlFor="batch-property" className="text-zinc-300">
                Property / Suite Label (optional)
              </Label>
              <Input
                id="batch-property"
                value={propertyLabel}
                onChange={(e) => setPropertyLabel(e.target.value)}
                placeholder="e.g., 450 Market St, Suite 1200"
                className="bg-zinc-900 border-zinc-800 text-zinc-50"
              />
            </div>

            {mode === "file" ? (
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  handleFileSelected(e.dataTransfer.files?.[0]);
                }}
                onClick={() => fileInputRef.current?.click()}
                className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-10 text-center transition-colors cursor-pointer ${
                  isDragging
                    ? "border-indigo-400 bg-indigo-950/30"
                    : "border-zinc-800 bg-zinc-900/50 hover:border-zinc-700"
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                  className="hidden"
                  onChange={(e) => handleFileSelected(e.target.files?.[0])}
                />
                {selectedFile ? (
                  <div className="space-y-2">
                    <FileText className="mx-auto h-10 w-10 text-indigo-400" />
                    <p className="text-sm font-medium text-zinc-100">{selectedFile.name}</p>
                    <p className="text-xs text-zinc-400">
                      {(selectedFile.size / 1024).toFixed(1)} KB · Click to replace
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Upload className="mx-auto h-10 w-10 text-zinc-500" />
                    <p className="text-sm font-medium text-zinc-200">
                      Drag and drop a lease file here, or click to browse
                    </p>
                    <p className="text-xs text-zinc-500">
                      Supports PDF, DOCX, and TXT up to 10MB
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="full-lease-text" className="text-zinc-300">
                  Full Lease Text
                </Label>
                <Textarea
                  id="full-lease-text"
                  value={pastedText}
                  onChange={(e) => setPastedText(e.target.value)}
                  placeholder="Paste multiple clauses or full lease agreement text..."
                  className="min-h-[220px] font-mono text-xs bg-zinc-900 border-zinc-800 text-zinc-100"
                />
              </div>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setOpen(false)}
                className="text-zinc-400"
              >
                Cancel
              </Button>
              <Button
                type="button"
                disabled={isExtracting}
                onClick={handleExtract}
                className="gap-2 bg-zinc-100 text-zinc-950 hover:bg-white"
              >
                {isExtracting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Extracting Deadlines...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Extract All Deadlines
                  </>
                )}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-3 max-h-[55vh] overflow-y-auto pr-1">
              {drafts.map((draft) => (
                <div
                  key={draft.id}
                  className={`rounded-lg border p-4 space-y-3 transition-colors ${
                    draft.selected
                      ? "border-zinc-700 bg-zinc-900/70"
                      : "border-zinc-900 bg-zinc-950/50 opacity-55"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => updateDraft(draft.id, { selected: !draft.selected })}
                      className="mt-1 text-zinc-300 hover:text-white"
                      aria-label={`Toggle ${draft.eventName}`}
                    >
                      {draft.selected ? (
                        <CheckSquare className="h-4 w-4 text-emerald-400" />
                      ) : (
                        <Square className="h-4 w-4 text-zinc-600" />
                      )}
                    </button>

                    <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <Input
                        value={draft.eventName}
                        onChange={(e) => updateDraft(draft.id, { eventName: e.target.value })}
                        className="sm:col-span-2 bg-zinc-950 border-zinc-800 text-zinc-100 text-sm"
                      />
                      <Input
                        type="date"
                        value={draft.triggerDate}
                        onChange={(e) => updateDraft(draft.id, { triggerDate: e.target.value })}
                        className="bg-zinc-950 border-zinc-800 text-zinc-100 font-mono text-xs"
                      />
                    </div>

                    <Badge variant="outline" className="capitalize border-zinc-700 text-zinc-300">
                      {draft.category}
                    </Badge>
                  </div>

                  <p className="text-xs text-zinc-400 italic pl-7">
                    &ldquo;{draft.sourceQuote}&rdquo;
                  </p>

                  <div className="pl-7 grid grid-cols-1 sm:grid-cols-3 gap-2 items-center">
                    <select
                      aria-label="Notification channel"
                      value={draft.notificationMethod}
                      onChange={(e) => {
                        const nextMethod = e.target.value as NotificationMethod;
                        updateDraft(draft.id, {
                          notificationMethod: nextMethod,
                          notificationTarget:
                            nextMethod === "email" ? defaultEmail : "",
                        });
                      }}
                      className="h-9 rounded-md border border-zinc-800 bg-zinc-950 px-2 text-xs text-zinc-100"
                    >
                      <option value="email">Email (Resend)</option>
                      <option value="slack">Slack Webhook</option>
                      <option value="custom">Custom Webhook</option>
                      <option value="sms">SMS (E.164)</option>
                    </select>

                    <Input
                      value={draft.notificationTarget}
                      onChange={(e) =>
                        updateDraft(draft.id, { notificationTarget: e.target.value })
                      }
                      placeholder={
                        draft.notificationMethod === "email"
                          ? "alerts@example.com"
                          : draft.notificationMethod === "sms"
                            ? "+14155552671"
                            : "https://hooks.slack.com/..."
                      }
                      className="sm:col-span-2 bg-zinc-950 border-zinc-800 text-zinc-100 text-xs"
                    />
                  </div>

                  <div className="pl-7 flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] text-zinc-500 mr-1">Reminders:</span>
                    {LEAD_TIME_OPTIONS.map((day) => {
                      const active = draft.leadTimeDays.includes(day);
                      return (
                        <button
                          key={day}
                          type="button"
                          onClick={() => toggleLeadTime(draft.id, day)}
                          className={`rounded-full px-2 py-0.5 text-[11px] border transition-colors ${
                            active
                              ? "border-indigo-500/50 bg-indigo-500/20 text-indigo-200"
                              : "border-zinc-800 bg-zinc-950 text-zinc-500 hover:text-zinc-300"
                          }`}
                        >
                          {day === 0 ? "Due day" : `${day}d before`}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <DialogFooter className="items-center justify-between sm:justify-between">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setStep("upload")}
                className="text-zinc-400"
              >
                ← Back
              </Button>
              <div className="flex gap-2">
                <Button
                  type="button"
                  disabled={isSaving || selectedCount === 0}
                  onClick={handleSaveSelected}
                  className="bg-zinc-100 text-zinc-950 hover:bg-white"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    `Create ${selectedCount} Sentinel${selectedCount === 1 ? "" : "s"}`
                  )}
                </Button>
              </div>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
