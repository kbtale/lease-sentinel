import { dispatchAlert } from "@/lib/webhook";
import { sendDeadlineEmail } from "@/lib/email";
import type { NotificationMethod } from "@/models/schema";

export interface DispatchTargetParams {
  notificationMethod: NotificationMethod;
  notificationTarget: string;
  eventName: string;
  triggerDate: string;
  originalClause: string;
  propertyLabel?: string;
  windowDays?: number;
  isTest?: boolean;
}

export interface DispatchOutcome {
  success: boolean;
  provider: string;
  error?: string;
}

export async function deliverSentinelNotification(
  params: DispatchTargetParams
): Promise<DispatchOutcome> {
  const makeWebhookUrl = process.env.MAKE_WEBHOOK_URL?.trim();
  const makeApiKey = process.env.MAKE_API_KEY?.trim();
  const reminderLabel = params.isTest
    ? "Test Alert"
    : params.windowDays && params.windowDays > 0
      ? `${params.windowDays}-day reminder`
      : "Deadline Due";

  if (params.notificationMethod === "custom") {
    const ok = await dispatchAlert(params.notificationTarget, {
      event: params.eventName,
      date: params.triggerDate,
      property: params.propertyLabel,
      clause: params.originalClause,
      windowDays: params.windowDays ?? 0,
      isTest: Boolean(params.isTest),
    });
    return {
      success: ok,
      provider: "webhook",
      error: ok ? undefined : "Webhook dispatch failed",
    };
  }

  if (params.notificationMethod === "email" && !makeWebhookUrl) {
    const emailResult = await sendDeadlineEmail({
      to: params.notificationTarget,
      eventName: params.eventName,
      triggerDate: params.triggerDate,
      originalClause: params.originalClause,
      propertyLabel: params.propertyLabel,
      reminderLabel,
      isTest: params.isTest,
    });
    return {
      success: emailResult.success,
      provider: "resend",
      error: emailResult.error,
    };
  }

  if (params.notificationMethod === "slack" && !makeWebhookUrl) {
    const prefix = params.isTest ? "[Test] " : `[${reminderLabel}] `;
    const propertyLine = params.propertyLabel
      ? `\nProperty: ${params.propertyLabel}`
      : "";
    const ok = await dispatchAlert(params.notificationTarget, {
      text: `${prefix}LeaseSentinel Alert: ${params.eventName} (Due ${params.triggerDate})${propertyLine}\n${params.originalClause}`,
      event: params.eventName,
      date: params.triggerDate,
      property: params.propertyLabel,
      clause: params.originalClause,
      windowDays: params.windowDays ?? 0,
      isTest: Boolean(params.isTest),
    });
    return {
      success: ok,
      provider: "slack",
      error: ok ? undefined : "Slack webhook dispatch failed",
    };
  }

  if (!makeWebhookUrl) {
    return {
      success: false,
      provider: "make",
      error: "MAKE_WEBHOOK_URL is not configured",
    };
  }

  const headers = makeApiKey ? { "x-make-apikey": makeApiKey } : undefined;
  const ok = await dispatchAlert(
    makeWebhookUrl,
    {
      method: params.notificationMethod,
      handle: params.notificationTarget,
      event: params.eventName,
      date: params.triggerDate,
      property: params.propertyLabel,
      clause: params.originalClause,
      windowDays: params.windowDays ?? 0,
      isTest: Boolean(params.isTest),
    },
    headers
  );

  return {
    success: ok,
    provider: "make",
    error: ok ? undefined : "Make.com dispatch failed",
  };
}
