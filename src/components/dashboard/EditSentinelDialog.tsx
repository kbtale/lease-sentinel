"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { NotificationMethod, Sentinel } from "@/models/schema";
import { updateSentinel } from "@/actions/sentinel.actions";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface EditSentinelDialogProps {
  sentinel: Sentinel | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const LEAD_TIME_OPTIONS = [30, 14, 7, 0];

export function EditSentinelDialog({
  sentinel,
  open,
  onOpenChange,
}: EditSentinelDialogProps) {
  const [eventName, setEventName] = useState(sentinel?.eventName ?? "");
  const [propertyLabel, setPropertyLabel] = useState(sentinel?.propertyLabel ?? "");
  const [triggerDate, setTriggerDate] = useState(sentinel?.triggerDate ?? "");
  const [notificationMethod, setNotificationMethod] = useState<NotificationMethod>(
    sentinel?.notificationMethod ?? "email"
  );
  const [notificationTarget, setNotificationTarget] = useState(
    sentinel?.notificationTarget ?? ""
  );
  const [originalClause, setOriginalClause] = useState(sentinel?.originalClause ?? "");
  const [leadTimeDays, setLeadTimeDays] = useState<number[]>(
    sentinel?.leadTimeDays?.length ? sentinel.leadTimeDays : [30, 7, 0]
  );
  const [isPending, startTransition] = useTransition();

  function toggleLeadTime(day: number) {
    setLeadTimeDays((prev) => {
      const exists = prev.includes(day);
      const next = exists
        ? prev.filter((d) => d !== day)
        : [...prev, day].sort((a, b) => b - a);
      return next.length > 0 ? next : [0];
    });
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!sentinel?.id) return;

    startTransition(async () => {
      const res = await updateSentinel(sentinel.id as string, {
        eventName,
        propertyLabel: propertyLabel.trim() || undefined,
        triggerDate,
        leadTimeDays,
        notificationMethod,
        notificationTarget,
        originalClause,
      });

      if (res.success) {
        toast.success(res.message);
        onOpenChange(false);
      } else {
        toast.error(res.message);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Edit Sentinel</DialogTitle>
          <DialogDescription>
            Update deadline details, lead-time reminders, or delivery destination.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="edit-event-name" className="text-zinc-300">
                Deadline Name
              </Label>
              <Input
                id="edit-event-name"
                value={eventName}
                onChange={(e) => setEventName(e.target.value)}
                required
                className="bg-zinc-900 border-zinc-800 text-zinc-100"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-trigger-date" className="text-zinc-300">
                Trigger Date
              </Label>
              <Input
                id="edit-trigger-date"
                type="date"
                value={triggerDate}
                onChange={(e) => setTriggerDate(e.target.value)}
                required
                className="bg-zinc-900 border-zinc-800 text-zinc-100 font-mono"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-property" className="text-zinc-300">
              Property / Unit Label
            </Label>
            <Input
              id="edit-property"
              value={propertyLabel}
              onChange={(e) => setPropertyLabel(e.target.value)}
              placeholder="e.g., 450 Market St, Suite 1200"
              className="bg-zinc-900 border-zinc-800 text-zinc-100"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="edit-method" className="text-zinc-300">
                Channel
              </Label>
              <select
                id="edit-method"
                value={notificationMethod}
                onChange={(e) =>
                  setNotificationMethod(e.target.value as NotificationMethod)
                }
                className="h-9 w-full rounded-md border border-zinc-800 bg-zinc-900 px-2.5 text-sm text-zinc-100"
              >
                <option value="email">Email (Resend)</option>
                <option value="slack">Slack Webhook</option>
                <option value="custom">Custom Webhook</option>
                <option value="sms">SMS (E.164)</option>
              </select>
            </div>

            <div className="sm:col-span-2 space-y-1.5">
              <Label htmlFor="edit-target" className="text-zinc-300">
                Destination
              </Label>
              <Input
                id="edit-target"
                value={notificationTarget}
                onChange={(e) => setNotificationTarget(e.target.value)}
                required
                className="bg-zinc-900 border-zinc-800 text-zinc-100"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-zinc-300">Reminder Lead Times</Label>
            <div className="flex flex-wrap gap-2">
              {LEAD_TIME_OPTIONS.map((day) => {
                const active = leadTimeDays.includes(day);
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => toggleLeadTime(day)}
                    className={`rounded-full px-3 py-1 text-xs border transition-colors ${
                      active
                        ? "border-indigo-500/50 bg-indigo-500/20 text-indigo-200"
                        : "border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    {day === 0 ? "On due date" : `${day}d before`}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-clause" className="text-zinc-300">
              Original Lease Clause
            </Label>
            <Textarea
              id="edit-clause"
              value={originalClause}
              onChange={(e) => setOriginalClause(e.target.value)}
              required
              className="min-h-[110px] font-mono text-xs bg-zinc-900 border-zinc-800 text-zinc-100"
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              className="text-zinc-400"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isPending}
              className="bg-zinc-100 text-zinc-950 hover:bg-white"
            >
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
