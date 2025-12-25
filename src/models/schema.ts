import { z } from "zod";

// Types inferred from Zod to ensure runtime validation matches compile-time types

// ============================================================================
// Enums
// ============================================================================

export const SentinelStatusEnum = z.enum(["PENDING", "FIRED"]);
export type SentinelStatus = z.infer<typeof SentinelStatusEnum>;

export const LogStatusEnum = z.enum(["SUCCESS", "FAILED"]);
export type LogStatus = z.infer<typeof LogStatusEnum>;

// ============================================================================
// Core Domain Schemas
// ============================================================================

/**
 * Sentinel Schema - represents a lease deadline to track.
 * Core domain entity for the application.
 */
export const SentinelSchema = z.object({
  id: z.string().optional(),
  userId: z.string(), // Required for Row-Level Security filtering
  eventName: z.string().min(3, "Event name must be at least 3 characters"),
  triggerDate: z.string().regex(
    /^\d{4}-\d{2}-\d{2}$/,
    "Trigger date must be in ISO format (YYYY-MM-DD)"
  ),
  originalClause: z.string(),
  webhookUrl: z.string().url("Webhook URL must be a valid URL"),
  status: SentinelStatusEnum.default("PENDING"),
  createdAt: z.date().default(() => new Date()),
});

// Types inferred from Zod for type safety
export type Sentinel = z.infer<typeof SentinelSchema>;

/**
 * Input schema for creating a new Sentinel (excludes server-generated fields).
 */
export const CreateSentinelInputSchema = z.object({
  eventName: z.string().min(3, "Event name must be at least 3 characters"),
  triggerDate: z.string().regex(
    /^\d{4}-\d{2}-\d{2}$/,
    "Trigger date must be in ISO format (YYYY-MM-DD)"
  ),
  originalClause: z.string(),
  webhookUrl: z.string().url("Webhook URL must be a valid URL"),
});

export type CreateSentinelInput = z.infer<typeof CreateSentinelInputSchema>;

/**
 * Schema for raw user input before AI processing.
 */
export const LeaseInputSchema = z.object({
  leaseText: z.string().min(10, "Lease clause must be at least 10 characters"),
  webhookUrl: z.string().url("Webhook URL must be a valid URL"),
});

export type LeaseInput = z.infer<typeof LeaseInputSchema>;

/**
 * Schema for AI extraction output from Gemini.
 */
export const AIExtractionSchema = z.object({
  eventName: z.string(),
  triggerDate: z.string().regex(
    /^\d{4}-\d{2}-\d{2}$/,
    "AI must return date in YYYY-MM-DD format"
  ),
});

export type AIExtraction = z.infer<typeof AIExtractionSchema>;

/**
 * Log Schema - tracks webhook dispatch results for auditing.
 */
export const LogSchema = z.object({
  id: z.string().optional(),
  sentinelId: z.string(),
  firedAt: z.string(),
  payload: z.record(z.string(), z.any()),
  status: LogStatusEnum,
});

// Types inferred from Zod for type safety
export type LogEntry = z.infer<typeof LogSchema>;

// ============================================================================
// Server Action Response Types
// ============================================================================

/**
 * Standardized Server Action state following the "never throw to client" pattern.
 * All server actions return this shape for consistent error handling.
 */
export interface ActionState<T = unknown> {
  success: boolean;
  message?: string;
  errors?: Record<string, string[]>;
  data?: T;
}

/**
 * Creates a successful action response.
 * 
 * @param data - The data payload to return.
 * @param message - Optional success message.
 * @returns ActionState with success=true.
 */
export function successState<T>(data: T, message?: string): ActionState<T> {
  return { success: true, data, message };
}

/**
 * Creates a failed action response.
 * 
 * @param message - Error message describing what went wrong.
 * @param errors - Optional field-level validation errors.
 * @returns ActionState with success=false.
 */
export function errorState(
  message: string,
  errors?: Record<string, string[]>
): ActionState<never> {
  return { success: false, message, errors };
}
