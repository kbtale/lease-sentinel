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
 * I use this pattern to never throw errors to the client.
 */
interface ActionResult {
  success: boolean;
  message: string;
  errors?: Record<string, string[]>;
}

/**
 * Schema for validating raw form input before AI processing.
 */
const FormInputSchema = z.object({
  clause: z.string().min(10, "Lease clause must be at least 10 characters"),
  webhookUrl: z.string().url("Webhook URL must be a valid URL"),
});

// ============================================================================
// Actions
// ============================================================================

/**
 * Creates a new Sentinel from lease text by extracting dates via AI.
 * Flow: Auth Check → Validate Input → AI Extraction → Validate Sentinel → Firestore Save → Revalidate.
 * 
 * @param prevState - Previous action state (for useActionState compatibility).
 * @param formData - Form data containing clause and webhookUrl fields.
 * @returns Standardized result object with success status and message.
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

    // A) Extract clause and webhookUrl from formData
    const rawInput = {
      clause: formData.get("clause"),
      webhookUrl: formData.get("webhookUrl"),
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

    const { clause, webhookUrl } = validatedInput.data;

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
      webhookUrl: webhookUrl,
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
 * I enforce that the user can only delete their own sentinels.
 * 
 * @param sentinelId - The Firestore document ID of the sentinel to delete.
 * @returns Standardized result object with success status and message.
 */
export async function deleteSentinel(
  sentinelId: string
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
