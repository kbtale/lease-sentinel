"use server";

import { getAdminDb } from "@/lib/firebase";
import {
  DEFAULT_LEAD_TIME_DAYS,
  LogEntry,
  LogStatus,
  NotificationMethod,
  Sentinel,
  SentinelStatus,
} from "@/models/schema";
import { auth } from "@/auth";

function toDateValue(raw: unknown): Date | undefined {
  if (raw && typeof (raw as { toDate?: () => Date }).toDate === "function") {
    return (raw as { toDate: () => Date }).toDate();
  }
  if (raw instanceof Date) {
    return raw;
  }
  if (typeof raw === "string") {
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }
  return undefined;
}

export async function getSentinels(): Promise<Sentinel[]> {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return [];
    }

    const snapshot = await getAdminDb()
      .collection("sentinels")
      .where("userId", "==", session.user.email)
      .orderBy("createdAt", "desc")
      .get();

    const sentinels: Sentinel[] = snapshot.docs.map((doc) => {
      const data = doc.data();
      const createdAt = toDateValue(data.createdAt) ?? new Date();
      const updatedAt = toDateValue(data.updatedAt);

      return {
        id: doc.id,
        userId: data.userId as string,
        eventName: data.eventName as string,
        propertyLabel:
          typeof data.propertyLabel === "string" && data.propertyLabel.trim()
            ? data.propertyLabel
            : undefined,
        triggerDate: data.triggerDate as string,
        originalClause: data.originalClause as string,
        webhookUrl: data.webhookUrl as string | undefined,
        notificationMethod: (data.notificationMethod || "custom") as NotificationMethod,
        notificationTarget: (data.notificationTarget || data.webhookUrl || "") as string,
        status: (data.status || "PENDING") as SentinelStatus,
        leadTimeDays:
          Array.isArray(data.leadTimeDays) && data.leadTimeDays.length > 0
            ? (data.leadTimeDays as number[])
            : [...DEFAULT_LEAD_TIME_DAYS],
        notifiedWindows: Array.isArray(data.notifiedWindows)
          ? (data.notifiedWindows as number[])
          : [],
        lastAttemptAt:
          typeof data.lastAttemptAt === "string" ? data.lastAttemptAt : undefined,
        createdAt,
        updatedAt,
      };
    });

    return sentinels;
  } catch (error) {
    console.error("Failed to fetch sentinels:", error);
    return [];
  }
}

export async function getSentinelLogs(sentinelId?: string): Promise<LogEntry[]> {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return [];
    }

    const db = getAdminDb();

    if (sentinelId) {
      const sentinelDoc = await db.collection("sentinels").doc(sentinelId).get();
      if (!sentinelDoc.exists || sentinelDoc.data()?.userId !== session.user.email) {
        return [];
      }
    }

    let query = db
      .collection("logs")
      .where("userId", "==", session.user.email);

    if (sentinelId) {
      query = query.where("sentinelId", "==", sentinelId);
    }

    const snapshot = await query.orderBy("firedAt", "desc").limit(50).get();

    return snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        sentinelId: data.sentinelId as string,
        userId: data.userId as string | undefined,
        firedAt: data.firedAt as string,
        payload: (data.payload || {}) as Record<string, unknown>,
        status: data.status as LogStatus,
      };
    });
  } catch (error) {
    console.error("Failed to fetch sentinel logs:", error);
    return [];
  }
}
