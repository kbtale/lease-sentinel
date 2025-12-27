/**
 * Domain schemas and types for LeaseSentinel.
 * 
 * @remarks
 * This module serves as the **single source of truth** for all domain types.
 * Zod schemas provide both compile-time TypeScript types (via `z.infer`) and
 * runtime validation. This ensures that data entering the system is validated
 * at the boundary (Server Actions) and typed correctly throughout.
 * 
 * @module
 * @category Database Schemas
 */

import { z } from "zod";

// ============================================================================
// Enums
// ============================================================================

/**
 * Status values for a Sentinel lifecycle.
 * 
 * @summary Enum defining the two states of a sentinel: awaiting trigger or already fired.
 * @category Database Schemas
 * 
 * @remarks
 * - `PENDING`: The sentinel is active and waiting for its trigger date
 * - `FIRED`: The webhook has been dispatched and the sentinel is complete
 */
export const SentinelStatusEnum = z.enum(["PENDING", "FIRED"]);

/**
 * TypeScript type inferred from {@link SentinelStatusEnum}.
 * @category Database Schemas
 */
export type SentinelStatus = z.infer<typeof SentinelStatusEnum>;

/**
 * Status values for webhook dispatch logging.
 * 
 * @summary Enum for tracking webhook delivery outcomes.
 * @category Database Schemas
 */
export const LogStatusEnum = z.enum(["SUCCESS", "FAILED"]);

/**
 * TypeScript type inferred from {@link LogStatusEnum}.
 * @category Database Schemas
 */
export type LogStatus = z.infer<typeof LogStatusEnum>;

// ============================================================================
// Core Domain Schemas
// ============================================================================

/**
 * Sentinel schema - the core domain entity representing a lease deadline to track.
 * 
 * @summary Zod schema defining the structure of a Sentinel record in Firestore.
 * @category Database Schemas
 * 
 * @remarks
 * A Sentinel represents a single deadline extracted from a lease clause. When
 * the `triggerDate` arrives, the system dispatches a webhook to the configured
 * URL and updates the status to `FIRED`.
 * 
 * **Row-Level Security**: The `userId` field is used to filter queries, ensuring
 * users can only access their own sentinels.
 * 
 * @property id - Firestore document ID (optional, set by Firestore on creation)
 * @property userId - User's email address for RLS filtering
 * @property eventName - Human-readable name for the deadline
 * @property triggerDate - ISO date (YYYY-MM-DD) when the webhook fires
 * @property originalClause - Raw lease text that was analyzed
 * @property webhookUrl - Destination URL for the alert
 * @property status - Current state: PENDING or FIRED
 * @property createdAt - Timestamp when the sentinel was created
 * 
 * @example
 * ```typescript
 * import { SentinelSchema, Sentinel } from "@/models/schema";
 * 
 * const data = {
 *   userId: "user@example.com",
 *   eventName: "Lease Renewal Deadline",
 *   triggerDate: "2025-06-15",
 *   originalClause: "Tenant must provide 90 days notice...",
 *   webhookUrl: "https://hooks.slack.com/...",
 * };
 * 
 * const result = SentinelSchema.safeParse(data);
 * if (result.success) {
 *   const sentinel: Sentinel = result.data;
 * }
 * ```
 */

/**
 * Notification method options for alert delivery.
 * 
 * @summary Enum defining supported notification channels.
 * @category Database Schemas
 */
export const NotificationMethodEnum = z.enum([
  "slack",
  "email",
  "sms",
  "custom"
]);

/**
 * TypeScript type for notification methods.
 * @category Database Schemas
 */
export type NotificationMethod = z.infer<typeof NotificationMethodEnum>;

export const SentinelSchema = z.object({
  id: z.string().optional(),
  userId: z.string(),
  eventName: z.string().min(3, "Event name must be at least 3 characters"),
  triggerDate: z.string().regex(
    /^\d{4}-\d{2}-\d{2}$/,
    "Trigger date must be in ISO format (YYYY-MM-DD)"
  ),
  originalClause: z.string(),
  /** @deprecated Use notificationMethod + notificationTarget instead */
  webhookUrl: z.string().optional(),
  notificationMethod: NotificationMethodEnum.default("custom"),
  notificationTarget: z.string(), // email, phone, or webhook URL
  status: SentinelStatusEnum.default("PENDING"),
  createdAt: z.date().default(() => new Date()),
});

/**
 * TypeScript type inferred from {@link SentinelSchema}.
 * @category Database Schemas
 */
export type Sentinel = z.infer<typeof SentinelSchema>;

/**
 * Input schema for creating a new Sentinel.
 * 
 * @summary Validation schema for user-provided sentinel data (excludes server-generated fields).
 * @category Database Schemas
 * 
 * @remarks
 * This schema validates the fields that come from user input or AI extraction.
 * Server-generated fields like `id`, `userId`, `status`, and `createdAt` are
 * added by the Server Action after validation.
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

/**
 * TypeScript type for sentinel creation input.
 * @category Database Schemas
 */
export type CreateSentinelInput = z.infer<typeof CreateSentinelInputSchema>;

/**
 * Schema for raw user input before AI processing.
 * 
 * @summary Validation schema for the lease submission form.
 * @category Database Schemas
 * 
 * @remarks
 * This schema validates what the user types into the form. The `leaseText`
 * is sent to the AI for extraction, and the `webhookUrl` is passed through
 * to the final Sentinel.
 */
export const LeaseInputSchema = z.object({
  leaseText: z.string().min(10, "Lease clause must be at least 10 characters"),
  webhookUrl: z.string().url("Webhook URL must be a valid URL"),
});

/**
 * TypeScript type for lease form input.
 * @category Database Schemas
 */
export type LeaseInput = z.infer<typeof LeaseInputSchema>;

/**
 * Schema for AI extraction output from Gemini.
 * 
 * @summary Validation schema for the structured data returned by the AI.
 * @category AI Extraction
 * 
 * @remarks
 * This schema validates the JSON response from Gemini before it's merged
 * with user input to create a Sentinel. If the AI returns malformed data,
 * validation will fail and the Server Action will return an error.
 * 
 * @see {@link extractLeaseData} for the function that produces this data.
 */
export const AIExtractionSchema = z.object({
  eventName: z.string(),
  triggerDate: z.string().regex(
    /^\d{4}-\d{2}-\d{2}$/,
    "AI must return date in YYYY-MM-DD format"
  ),
});

/**
 * TypeScript type for AI extraction results.
 * @category AI Extraction
 */
export type AIExtraction = z.infer<typeof AIExtractionSchema>;

/**
 * Log schema for tracking webhook dispatch results.
 * 
 * @summary Audit log entry for webhook delivery attempts.
 * @category Database Schemas
 * 
 * @remarks
 * Logs are created after each webhook dispatch attempt, recording whether
 * the delivery succeeded or failed. This enables debugging failed deliveries
 * and provides an audit trail for compliance.
 * 
 * @property sentinelId - Reference to the sentinel that triggered this log
 * @property firedAt - ISO timestamp of the dispatch attempt
 * @property payload - The JSON payload that was sent
 * @property status - Delivery outcome: SUCCESS or FAILED
 */
export const LogSchema = z.object({
  id: z.string().optional(),
  sentinelId: z.string(),
  firedAt: z.string(),
  payload: z.record(z.string(), z.any()),
  status: LogStatusEnum,
});

/**
 * TypeScript type for log entries.
 * @category Database Schemas
 */
export type LogEntry = z.infer<typeof LogSchema>;

// ============================================================================
// Server Action Response Types
// ============================================================================

/**
 * Standardized Server Action response following the "never throw to client" pattern.
 * 
 * @summary Generic response type ensuring consistent error handling across all mutations.
 * @category Server Actions
 * 
 * @remarks
 * All Server Actions return this shape instead of throwing errors. This enables
 * predictable client-side handling with React's `useActionState` hook:
 * 
 * ```tsx
 * const [state, action] = useActionState(myAction, null);
 * if (state && !state.success) {
 *   // Handle error
 * }
 * ```
 * 
 * @typeParam T - The type of data returned on success
 * 
 * @property success - Whether the action completed successfully
 * @property message - Human-readable status message
 * @property errors - Field-level validation errors (for form display)
 * @property data - The returned data on success
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
 * @summary Factory function for constructing success ActionState objects.
 * @category Server Actions
 * 
 * @param data - The data payload to return.
 * @param message - Optional success message for UI display.
 * 
 * @returns {@link ActionState} with `success: true` and the provided data.
 * 
 * @example
 * ```typescript
 * return successState({ id: "abc123" }, "Sentinel created");
 * ```
 */
export function successState<T>(data: T, message?: string): ActionState<T> {
  return { success: true, data, message };
}

/**
 * Creates a failed action response.
 * 
 * @summary Factory function for constructing error ActionState objects.
 * @category Server Actions
 * 
 * @param message - Error message describing what went wrong.
 * @param errors - Optional field-level validation errors for form fields.
 * 
 * @returns {@link ActionState} with `success: false` and error details.
 * 
 * @example
 * ```typescript
 * return errorState("Validation failed", {
 *   eventName: ["Event name is required"],
 * });
 * ```
 */
export function errorState(
  message: string,
  errors?: Record<string, string[]>
): ActionState<never> {
  return { success: false, message, errors };
}
