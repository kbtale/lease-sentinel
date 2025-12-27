"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getAdminDb } from "@/lib/firebase";
import { extractLeaseData } from "@/lib/ai";
import { SentinelSchema } from "@/models/schema";
import { auth } from "@/auth";

// ============================================================================
// Types
// ============================================================================

/**
 * Standardized result object for Server Actions.
 * 
 * @summary Return type for all mutation actions—ensures consistent error handling.
 * @category Server Actions
 * 
 * @remarks
 * This pattern guarantees that Server Actions **never throw** to the client.
 * All errors are captured and returned as structured data, enabling
 * predictable UI state management with `useActionState`.
 * 
 * @see {@link SentinelSchema} for the domain entity this action creates.
 */
interface ActionResult {
  /** Whether the action completed successfully. */
  success: boolean;
  /** Human-readable status message for UI display. */
  message: string;
  /** Field-level validation errors keyed by field name. */
  errors?: Record<string, string[]>;
}

/**
 * Schema for validating raw form input before AI processing.
 * 
 * @summary Zod schema for lease clause submission form.
 * @category Database Schemas
 * 
 * @remarks
 * This schema validates the **user-provided** input before it's sent to
 * the AI for extraction. The AI output is then validated separately
 * against {@link SentinelSchema}.
 */
const FormInputSchema = z.object({
  /** Natural language lease clause containing date/deadline information. */
  clause: z.string().min(10, "Lease clause must be at least 10 characters"),
  /** Notification delivery method. */
  notificationMethod: z.enum(["slack", "teams", "email", "sms", "custom"]),
  /** Target for notifications (email, phone, or webhook URL depending on method). */
  notificationTarget: z.string().min(1, "Notification target is required"),
});

// ============================================================================
// Actions
// ============================================================================

/**
 * Creates a new Sentinel from natural language lease text.
 * 
 * @summary Validates input, extracts dates via Gemini AI, and persists to Firestore.
 * @category Server Actions
 * 
 * @security
 * **Authentication Required**: Rejects unauthenticated requests immediately.
 * 
 * **Row-Level Security**: The created Sentinel is tagged with the user's email
 * as `userId`. All subsequent queries filter by this field, ensuring users
 * can only access their own data.
 * 
 * @remarks
 * This is the primary entry point for the Sentinel creation flow:
 * 
 * ```
 * Auth Check → Validate Input → AI Extraction → Validate Sentinel → Firestore Save → Revalidate
 * ```
 * 
 * The function uses {@link FormInputSchema} for input validation and
 * {@link SentinelSchema} for the final entity validation before persistence.
 * 
 * @param prevState - Previous action state (for `useActionState` compatibility).
 *   Pass `null` for initial renders.
 * @param formData - Form data containing:
 *   - `clause`: Natural language lease text
 *   - `webhookUrl`: Destination for deadline notifications
 * 
 * @returns Promise resolving to {@link ActionResult} with:
 *   - `success: true` + confirmation message on success
 *   - `success: false` + error details on failure
 * 
 * @example
 * ```tsx
 * // Client component usage with useActionState
 * "use client";
 * import { useActionState } from "react";
 * import { createSentinel } from "@/actions/sentinel.actions";
 * 
 * export function CreateSentinelForm() {
 *   const [state, formAction, pending] = useActionState(createSentinel, null);
 * 
 *   return (
 *     <form action={formAction}>
 *       <textarea name="clause" placeholder="Paste lease clause..." />
 *       <input name="webhookUrl" placeholder="https://hooks.slack.com/..." />
 *       <button disabled={pending}>
 *         {pending ? "Creating..." : "Create Sentinel"}
 *       </button>
 *       {state?.message && <p>{state.message}</p>}
 *     </form>
 *   );
 * }
 * ```
 * 
 * @see {@link extractLeaseData} for the AI extraction logic.
 * @see {@link SentinelSchema} for the entity structure.
 */
export async function createSentinel(
  prevState: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  try {
    // Auth check - I enforce authentication for data isolation
    const session = await auth();
    if (!session?.user?.email) {
      return {
        success: false,
        message: "Unauthorized. Please sign in.",
      };
    }

    // A) Extract form fields
    const rawInput = {
      clause: formData.get("clause"),
      notificationMethod: formData.get("notificationMethod"),
      notificationTarget: formData.get("notificationTarget"),
    };

    // B) Validate inputs using Zod
    const validatedInput = FormInputSchema.safeParse(rawInput);

    if (!validatedInput.success) {
      const zodErrors: Record<string, string[]> = {};
      for (const issue of validatedInput.error.issues) {
        const field = issue.path.join(".");
        if (!zodErrors[field]) {
          zodErrors[field] = [];
        }
        zodErrors[field].push(issue.message);
      }

      return {
        success: false,
        message: "Validation failed",
        errors: zodErrors,
      };
    }

    const { clause, notificationMethod, notificationTarget } = validatedInput.data;

    // C) Call extractLeaseData
    const extracted = await extractLeaseData(clause);

    // D) If AI returns null, return error
    if (!extracted) {
      return {
        success: false,
        message: "AI extraction failed. Please try rephrasing the clause.",
      };
    }

    // E) Merge AI results with user input, including userId for RLS
    const sentinelData = {
      userId: session.user.email, // Email as userId for Row-Level Security
      eventName: extracted.eventName,
      triggerDate: extracted.triggerDate,
      originalClause: clause,
      notificationMethod: notificationMethod,
      notificationTarget: notificationTarget,
      status: "PENDING" as const,
      createdAt: new Date(),
    };

    // F) Validate the final object against SentinelSchema
    const validatedSentinel = SentinelSchema.safeParse(sentinelData);

    if (!validatedSentinel.success) {
      return {
        success: false,
        message: "Invalid sentinel data generated",
      };
    }

    // G) Save to Firestore collection 'sentinels'
    await getAdminDb().collection("sentinels").add(validatedSentinel.data);

    // H) Revalidate the dashboard path
    revalidatePath("/");

    // I) Return success
    return {
      success: true,
      message: "Sentinel created successfully",
    };
  } catch (error) {
    console.error("Error creating sentinel:", error);

    const message =
      error instanceof Error ? error.message : "Failed to create sentinel";

    return {
      success: false,
      message,
    };
  }
}

/**
 * Deletes a Sentinel by its Firestore document ID.
 * 
 * @summary Verifies ownership and removes a Sentinel from the database.
 * @category Server Actions
 * 
 * @security
 * **Authentication Required**: Rejects unauthenticated requests.
 * 
 * **Ownership Verification**: Before deletion, the function fetches the document
 * and verifies that `userId` matches the authenticated user's email. This prevents
 * users from deleting other users' Sentinels even if they obtain a document ID.
 * 
 * @remarks
 * This action performs a **hard delete**—the Sentinel is permanently removed
 * from Firestore. Consider implementing soft-delete (status flag) if audit
 * trails are required.
 * 
 * Flow:
 * ```
 * Auth Check → Fetch Document → Verify Ownership → Delete → Revalidate
 * ```
 * 
 * @param sentinelId - The Firestore document ID of the sentinel to delete.
 *   Obtain this from {@link fetchSentinels} or the UI.
 * 
 * @returns Promise resolving to {@link ActionResult} with:
 *   - `success: true` on successful deletion
 *   - `success: false` + error message on auth failure or invalid ID
 * 
 * @example
 * ```tsx
 * // Client component usage with server action binding
 * "use client";
 * import { deleteSentinel } from "@/actions/sentinel.actions";
 * import { useTransition } from "react";
 * 
 * export function DeleteButton({ sentinelId }: { sentinelId: string }) {
 *   const [pending, startTransition] = useTransition();
 * 
 *   const handleDelete = () => {
 *     startTransition(async () => {
 *       const result = await deleteSentinel(sentinelId);
 *       if (!result.success) {
 *         console.error(result.message);
 *       }
 *     });
 *   };
 * 
 *   return (
 *     <button onClick={handleDelete} disabled={pending}>
 *       {pending ? "Deleting..." : "Delete"}
 *     </button>
 *   );
 * }
 * ```
 * 
 * @see {@link createSentinel} for the creation counterpart.
 * @see {@link fetchSentinels} to get sentinel IDs.
 */
export async function deleteSentinel(
  sentinelId: string
): Promise<ActionResult> {
  try {
    // Auth check
    const session = await auth();
    if (!session?.user?.email) {
      return {
        success: false,
        message: "Unauthorized. Please sign in.",
      };
    }

    // Verify ownership before delete
    const doc = await getAdminDb().collection("sentinels").doc(sentinelId).get();
    if (!doc.exists || doc.data()?.userId !== session.user.email) {
      return {
        success: false,
        message: "Sentinel not found or access denied.",
      };
    }

    await getAdminDb().collection("sentinels").doc(sentinelId).delete();

    revalidatePath("/");

    return {
      success: true,
      message: "Sentinel deleted successfully",
    };
  } catch (error) {
    console.error("Error deleting sentinel:", error);

    const message =
      error instanceof Error ? error.message : "Failed to delete sentinel";

    return {
      success: false,
      message,
    };
  }
}
