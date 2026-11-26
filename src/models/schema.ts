import { z } from "zod";

export const SentinelStatusEnum = z.enum(["PENDING", "FIRED"]);

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

export const SentinelSchema = z.object({
  id: z.string().optional(),
  userId: z.string(),
  eventName: z.string().min(3, "Event name must be at least 3 characters"),
  triggerDate: IsoDateSchema,
  originalClause: z.string(),
  webhookUrl: z.string().optional(),
  notificationMethod: NotificationMethodEnum.default("custom"),
  notificationTarget: z.string(),
  status: SentinelStatusEnum.default("PENDING"),
  notifiedWindows: z.array(z.number().int().min(0)).default([]),
  lastAttemptAt: z.string().optional(),
  createdAt: z.date().default(() => new Date()),
});

export type Sentinel = z.infer<typeof SentinelSchema>;

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
