"use client";

// React
import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";

// Third Party
import { toast } from "sonner";

// Local - Actions
import { createSentinel } from "@/actions/sentinel.actions";

// Local - UI
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

// ============================================================================
// Types
// ============================================================================

interface FormState {
  success: boolean;
  message: string;
  errors?: Record<string, string[]>;
}

// ============================================================================
// Submit Button (needs useFormStatus)
// ============================================================================

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? "Analyzing..." : "Create Sentinel"}
    </Button>
  );
}

// ============================================================================
// Component
// ============================================================================

export function CreateSentinelForm() {
  // Hooks
  const [state, formAction] = useActionState<FormState | null, FormData>(
    createSentinel,
    null
  );

  // Effects - show toast on success
  useEffect(() => {
    if (state?.success) {
      toast.success(state.message);
    }
  }, [state]);

  // Derived state
  const hasError = state !== null && !state.success;

  // Render
  return (
    <Card>
      <CardHeader>
        <CardTitle>Create New Sentinel</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="clause">Lease Clause</Label>
            <Textarea
              id="clause"
              name="clause"
              placeholder="Paste your lease clause here... (e.g., 'Notice must be given 6 months before Dec 31, 2025')"
              rows={4}
              required
              className="resize-none"
            />
            {state?.errors?.clause && (
              <p className="text-sm text-destructive">{state.errors.clause[0]}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="webhookUrl">Webhook URL</Label>
            <Input
              id="webhookUrl"
              name="webhookUrl"
              type="url"
              placeholder="https://discord.com/api/webhooks/..."
              required
            />
            {state?.errors?.webhookUrl && (
              <p className="text-sm text-destructive">{state.errors.webhookUrl[0]}</p>
            )}
          </div>

          {hasError && !state?.errors && (
            <div className="p-3 bg-destructive/10 border border-destructive rounded-md">
              <p className="text-sm text-destructive">{state?.message}</p>
            </div>
          )}

          <SubmitButton />
        </form>
      </CardContent>
    </Card>
  );
}
