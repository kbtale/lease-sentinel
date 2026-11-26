"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getAdminDb } from "@/lib/firebase";
import { extractLeaseData } from "@/lib/ai";
import { validateNotificationTarget } from "@/lib/url-safety";
import { SentinelSchema } from "@/models/schema";
import { auth } from "@/auth";

interface ActionResult {
  success: boolean;
  message: string;
  errors?: Record<string, string[]>;
}

const FormInputSchema = z.object({
  clause: z.string().min(10, "Lease clause must be at least 10 characters"),
  notificationMethod: z.enum(["slack", "email", "sms", "custom"]),
  notificationTarget: z.string().min(1, "Notification target is required"),
});

export async function createSentinel(
  prevState: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return {
        success: false,
        message: "Unauthorized. Please sign in.",
      };
    }

    const rawInput = {
      clause: formData.get("clause"),
      notificationMethod: formData.get("notificationMethod"),
      notificationTarget: formData.get("notificationTarget"),
    };

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
    const targetValidation = await validateNotificationTarget(
      notificationMethod,
      notificationTarget
    );

    if (!targetValidation.valid) {
      return {
        success: false,
        message: targetValidation.reason || "Invalid notification target",
        errors: {
          notificationTarget: [targetValidation.reason || "Invalid notification target"],
        },
      };
    }

    const extracted = await extractLeaseData(clause);

    if (!extracted) {
      return {
        success: false,
        message: "AI extraction failed. Please try rephrasing the clause.",
      };
    }

    const sentinelData = {
      userId: session.user.email,
      eventName: extracted.eventName,
      triggerDate: extracted.triggerDate,
      originalClause: clause,
      notificationMethod,
      notificationTarget: notificationTarget.trim(),
      status: "PENDING" as const,
      notifiedWindows: [] as number[],
      createdAt: new Date(),
    };

    const validatedSentinel = SentinelSchema.safeParse(sentinelData);

    if (!validatedSentinel.success) {
      return {
        success: false,
        message: "Invalid sentinel data generated",
      };
    }

    await getAdminDb().collection("sentinels").add(validatedSentinel.data);

    revalidatePath("/");

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

export async function deleteSentinel(
  sentinelId: string
): Promise<ActionResult> {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return {
        success: false,
        message: "Unauthorized. Please sign in.",
      };
    }

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
