"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getAdminDb } from "@/lib/firebase";
import { extractLeaseData, extractMultipleLeaseDeadlines } from "@/lib/ai";
import { parseLeaseDocument } from "@/lib/document-parser";
import { validateNotificationTarget } from "@/lib/url-safety";
import { deliverSentinelNotification } from "@/lib/dispatch";
import {
  BatchSentinelItem,
  CreateSentinelsBatchSchema,
  DEFAULT_LEAD_TIME_DAYS,
  ExtractedDeadline,
  LogSchema,
  Sentinel,
  SentinelSchema,
  SentinelStatus,
  SentinelStatusEnum,
  UpdateSentinelInput,
  UpdateSentinelInputSchema,
} from "@/models/schema";
import { auth } from "@/auth";

interface ActionResult<T = undefined> {
  success: boolean;
  message: string;
  errors?: Record<string, string[]>;
  data?: T;
}

const FormInputSchema = z.object({
  clause: z.string().min(10, "Lease clause must be at least 10 characters"),
  propertyLabel: z.string().trim().max(120).optional(),
  notificationMethod: z.enum(["slack", "email", "sms", "custom"]),
  notificationTarget: z.string().min(1, "Notification target is required"),
});

function parseLeadTimeDaysFromForm(raw: FormDataEntryValue | null): number[] {
  if (typeof raw !== "string" || !raw.trim()) {
    return [...DEFAULT_LEAD_TIME_DAYS];
  }
  const parsed = raw
    .split(",")
    .map((part) => Number(part.trim()))
    .filter((n) => Number.isInteger(n) && n >= 0 && n <= 365);
  return parsed.length > 0
    ? Array.from(new Set(parsed)).sort((a, b) => b - a)
    : [...DEFAULT_LEAD_TIME_DAYS];
}

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

    const rawProperty = formData.get("propertyLabel");
    const rawInput = {
      clause: formData.get("clause"),
      propertyLabel:
        typeof rawProperty === "string" && rawProperty.trim()
          ? rawProperty.trim()
          : undefined,
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

    const { clause, propertyLabel, notificationMethod, notificationTarget } =
      validatedInput.data;
    const targetValidation = await validateNotificationTarget(
      notificationMethod,
      notificationTarget
    );

    if (!targetValidation.valid) {
      return {
        success: false,
        message: targetValidation.reason || "Invalid notification target",
        errors: {
          notificationTarget: [
            targetValidation.reason || "Invalid notification target",
          ],
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

    const leadTimeDays = parseLeadTimeDaysFromForm(formData.get("leadTimeDays"));
    const now = new Date();
    const sentinelData = {
      userId: session.user.email,
      eventName: extracted.eventName,
      propertyLabel,
      triggerDate: extracted.triggerDate,
      originalClause: clause,
      notificationMethod,
      notificationTarget: notificationTarget.trim(),
      status: "PENDING" as const,
      leadTimeDays,
      notifiedWindows: [] as number[],
      createdAt: now,
      updatedAt: now,
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

export async function extractLeaseDocumentAction(
  formData: FormData
): Promise<
  ActionResult<{
    deadlines: ExtractedDeadline[];
    fileName: string;
    characterCount: number;
  }>
> {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return {
        success: false,
        message: "Unauthorized. Please sign in.",
      };
    }

    const uploadedFile = formData.get("file");
    const pastedText = formData.get("text");

    let text = "";
    let fileName = "pasted-lease.txt";

    if (uploadedFile && typeof uploadedFile === "object" && "arrayBuffer" in uploadedFile) {
      const file = uploadedFile as File;
      const arrayBuffer = await file.arrayBuffer();
      const parsed = await parseLeaseDocument({
        name: file.name,
        type: file.type,
        size: file.size,
        buffer: Buffer.from(arrayBuffer),
      });
      text = parsed.text;
      fileName = parsed.fileName;
    } else if (typeof pastedText === "string" && pastedText.trim().length >= 20) {
      text = pastedText.trim();
    } else {
      return {
        success: false,
        message: "Please upload a lease document or paste lease text.",
      };
    }

    const deadlines = await extractMultipleLeaseDeadlines(text);

    return {
      success: true,
      message: `Extracted ${deadlines.length} deadline${deadlines.length === 1 ? "" : "s"}`,
      data: {
        deadlines,
        fileName,
        characterCount: text.length,
      },
    };
  } catch (error) {
    console.error("Error extracting lease document:", error);
    return {
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to extract lease deadlines",
    };
  }
}

export async function createSentinelsBatch(
  items: BatchSentinelItem[]
): Promise<ActionResult<{ createdCount: number }>> {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return {
        success: false,
        message: "Unauthorized. Please sign in.",
      };
    }

    const validatedBatch = CreateSentinelsBatchSchema.safeParse(items);
    if (!validatedBatch.success) {
      return {
        success: false,
        message: validatedBatch.error.issues[0]?.message || "Invalid sentinel batch",
      };
    }

    for (const item of validatedBatch.data) {
      const targetCheck = await validateNotificationTarget(
        item.notificationMethod,
        item.notificationTarget
      );
      if (!targetCheck.valid) {
        return {
          success: false,
          message: `Invalid target for "${item.eventName}": ${targetCheck.reason}`,
        };
      }
    }

    const db = getAdminDb();
    const batch = db.batch();
    const collection = db.collection("sentinels");
    const now = new Date();

    for (const item of validatedBatch.data) {
      const sentinelData = SentinelSchema.parse({
        userId: session.user.email,
        eventName: item.eventName,
        propertyLabel: item.propertyLabel || undefined,
        triggerDate: item.triggerDate,
        originalClause: item.originalClause,
        notificationMethod: item.notificationMethod,
        notificationTarget: item.notificationTarget.trim(),
        status: "PENDING",
        leadTimeDays: item.leadTimeDays,
        notifiedWindows: [],
        createdAt: now,
        updatedAt: now,
      });

      const docRef = collection.doc();
      batch.set(docRef, sentinelData);
    }

    await batch.commit();
    revalidatePath("/");

    const createdCount = validatedBatch.data.length;
    return {
      success: true,
      message: `Created ${createdCount} sentinel${createdCount === 1 ? "" : "s"} successfully`,
      data: { createdCount },
    };
  } catch (error) {
    console.error("Error creating sentinel batch:", error);
    return {
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to save extracted deadlines",
    };
  }
}

export async function updateSentinel(
  sentinelId: string,
  input: UpdateSentinelInput
): Promise<ActionResult> {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return {
        success: false,
        message: "Unauthorized. Please sign in.",
      };
    }

    const validated = UpdateSentinelInputSchema.safeParse(input);
    if (!validated.success) {
      const zodErrors: Record<string, string[]> = {};
      for (const issue of validated.error.issues) {
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

    const targetValidation = await validateNotificationTarget(
      validated.data.notificationMethod,
      validated.data.notificationTarget
    );
    if (!targetValidation.valid) {
      return {
        success: false,
        message: targetValidation.reason || "Invalid notification target",
        errors: {
          notificationTarget: [
            targetValidation.reason || "Invalid notification target",
          ],
        },
      };
    }

    const docRef = getAdminDb().collection("sentinels").doc(sentinelId);
    const doc = await docRef.get();
    if (!doc.exists || doc.data()?.userId !== session.user.email) {
      return {
        success: false,
        message: "Sentinel not found or access denied.",
      };
    }

    const existing = doc.data() as Sentinel;
    const dateChanged = existing.triggerDate !== validated.data.triggerDate;
    const updateData: Record<string, unknown> = {
      eventName: validated.data.eventName,
      propertyLabel: validated.data.propertyLabel || null,
      triggerDate: validated.data.triggerDate,
      leadTimeDays: validated.data.leadTimeDays,
      notificationMethod: validated.data.notificationMethod,
      notificationTarget: validated.data.notificationTarget.trim(),
      originalClause: validated.data.originalClause,
      updatedAt: new Date(),
    };

    if (dateChanged) {
      updateData.notifiedWindows = [];
      if (existing.status === "FIRED") {
        updateData.status = "PENDING";
      }
    }

    await docRef.update(updateData);
    revalidatePath("/");

    return {
      success: true,
      message: "Sentinel updated successfully",
    };
  } catch (error) {
    console.error("Error updating sentinel:", error);
    return {
      success: false,
      message: error instanceof Error ? error.message : "Failed to update sentinel",
    };
  }
}

export async function updateSentinelStatus(
  sentinelId: string,
  status: SentinelStatus
): Promise<ActionResult> {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return {
        success: false,
        message: "Unauthorized. Please sign in.",
      };
    }

    const parsedStatus = SentinelStatusEnum.safeParse(status);
    if (!parsedStatus.success) {
      return {
        success: false,
        message: "Invalid sentinel status",
      };
    }

    const docRef = getAdminDb().collection("sentinels").doc(sentinelId);
    const doc = await docRef.get();
    if (!doc.exists || doc.data()?.userId !== session.user.email) {
      return {
        success: false,
        message: "Sentinel not found or access denied.",
      };
    }

    await docRef.update({
      status: parsedStatus.data,
      updatedAt: new Date(),
    });
    revalidatePath("/");

    return {
      success: true,
      message: `Sentinel marked as ${parsedStatus.data.toLowerCase()}`,
    };
  } catch (error) {
    console.error("Error updating sentinel status:", error);
    return {
      success: false,
      message: error instanceof Error ? error.message : "Failed to update status",
    };
  }
}

export async function sendTestAlert(sentinelId: string): Promise<ActionResult> {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return {
        success: false,
        message: "Unauthorized. Please sign in.",
      };
    }

    const docRef = getAdminDb().collection("sentinels").doc(sentinelId);
    const doc = await docRef.get();
    if (!doc.exists || doc.data()?.userId !== session.user.email) {
      return {
        success: false,
        message: "Sentinel not found or access denied.",
      };
    }

    const data = doc.data() as Sentinel;
    const firedAt = new Date().toISOString();
    const outcome = await deliverSentinelNotification({
      notificationMethod: data.notificationMethod,
      notificationTarget: data.notificationTarget,
      eventName: data.eventName,
      triggerDate: data.triggerDate,
      originalClause: data.originalClause,
      propertyLabel: data.propertyLabel,
      isTest: true,
    });

    const logData = LogSchema.parse({
      sentinelId,
      userId: session.user.email,
      firedAt,
      status: outcome.success ? "SUCCESS" : "FAILED",
      payload: {
        method: data.notificationMethod,
        provider: outcome.provider,
        event: data.eventName,
        date: data.triggerDate,
        isTest: true,
        ...(outcome.error ? { error: outcome.error } : {}),
      },
    });

    await getAdminDb().collection("logs").add(logData);

    if (!outcome.success) {
      return {
        success: false,
        message: outcome.error || "Failed to send test alert",
      };
    }

    return {
      success: true,
      message: `Test alert sent via ${outcome.provider}`,
    };
  } catch (error) {
    console.error("Error sending test alert:", error);
    return {
      success: false,
      message: error instanceof Error ? error.message : "Failed to send test alert",
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
