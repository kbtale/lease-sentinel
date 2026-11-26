import { z } from "zod";

export const SentinelStatusEnum = z.enum(["PENDING", "PAUSED", "FIRED", "RESOLVED"]);

export type SentinelStatus = z.infer<typeof SentinelStatusEnum>;

export const LogStatusEnum = z.enum(["SUCCESS", "FAILED"]);

export type LogStatus = z.infer<typeof LogStatusEnum>;

export const NotificationMethodEnum = z.enum([
  "slack",
  "email",
  "sms",
  "custom",
]);

export type NotificationMethod = z.infer<typeof NotificationMethodEnum>;

export const DEFAULT_LEAD_TIME_DAYS = [30, 7, 0] as const;

export function isValidIsoCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export const IsoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in ISO format (YYYY-MM-DD)")
  .refine(isValidIsoCalendarDate, "Date must be a valid calendar date");

export const LeadTimeDaysSchema = z
  .array(z.number().int().min(0).max(365))
  .min(1, "Select at least one reminder window")
  .transform((days) => Array.from(new Set(days)).sort((a, b) => b - a));

export const SentinelSchema = z.object({
  id: z.string().optional(),
  userId: z.string(),
  eventName: z.string().trim().min(3, "Event name must be at least 3 characters"),
  propertyLabel: z.string().trim().max(120).optional(),
  triggerDate: IsoDateSchema,
  originalClause: z.string(),
  webhookUrl: z.string().optional(),
  notificationMethod: NotificationMethodEnum.default("custom"),
  notificationTarget: z.string(),
  status: SentinelStatusEnum.default("PENDING"),
  leadTimeDays: z.array(z.number().int().min(0).max(365)).default([30, 7, 0]),
  notifiedWindows: z.array(z.number().int().min(0)).default([]),
  lastAttemptAt: z.string().optional(),
  createdAt: z.date().default(() => new Date()),
  updatedAt: z.date().optional(),
});

export type Sentinel = z.infer<typeof SentinelSchema>;

export const UpdateSentinelInputSchema = z.object({
  eventName: z.string().trim().min(3, "Event name must be at least 3 characters"),
  propertyLabel: z.string().trim().max(120).optional(),
  triggerDate: IsoDateSchema,
  leadTimeDays: LeadTimeDaysSchema.default([30, 7, 0]),
  notificationMethod: NotificationMethodEnum,
  notificationTarget: z.string().trim().min(1, "Notification target is required"),
  originalClause: z.string().trim().min(5, "Lease clause must be at least 5 characters"),
});

export type UpdateSentinelInput = z.infer<typeof UpdateSentinelInputSchema>;

export const CreateSentinelInputSchema = z.object({
  eventName: z.string().min(3, "Event name must be at least 3 characters"),
  triggerDate: IsoDateSchema,
  originalClause: z.string(),
  webhookUrl: z.string().url("Webhook URL must be a valid URL"),
});

export type CreateSentinelInput = z.infer<typeof CreateSentinelInputSchema>;

export const LeaseInputSchema = z.object({
  leaseText: z.string().min(10, "Lease clause must be at least 10 characters"),
  webhookUrl: z.string().url("Webhook URL must be a valid URL"),
});

export type LeaseInput = z.infer<typeof LeaseInputSchema>;

export const AIExtractionSchema = z.object({
  eventName: z.string().trim().min(1, "Event name is required"),
  triggerDate: IsoDateSchema,
});

export type AIExtraction = z.infer<typeof AIExtractionSchema>;

export const LogSchema = z.object({
  id: z.string().optional(),
  sentinelId: z.string(),
  userId: z.string().optional(),
  firedAt: z.string(),
  payload: z.record(z.string(), z.any()),
  status: LogStatusEnum,
});

export type LogEntry = z.infer<typeof LogSchema>;

export interface ActionState<T = unknown> {
  success: boolean;
  message?: string;
  errors?: Record<string, string[]>;
  data?: T;
}

export function successState<T>(data: T, message?: string): ActionState<T> {
  return { success: true, data, message };
}

export function errorState(
  message: string,
  errors?: Record<string, string[]>
): ActionState<never> {
  return { success: false, message, errors };
}
