import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase";
import { deliverSentinelNotification } from "@/lib/dispatch";
import { addDaysISO, getDueReminderWindow, getTodayISO } from "@/lib/date-utils";
import { DEFAULT_LEAD_TIME_DAYS, LogSchema, Sentinel } from "@/models/schema";

export const dynamic = "force-dynamic";

function isAuthorizedCronRequest(authHeader: string | null, cronSecret: string): boolean {
  if (!authHeader) {
    return false;
  }
  const expected = `Bearer ${cronSecret}`;
  const actualBuf = Buffer.from(authHeader, "utf8");
  const expectedBuf = Buffer.from(expected, "utf8");
  if (actualBuf.length !== expectedBuf.length) {
    return false;
  }
  return crypto.timingSafeEqual(actualBuf, expectedBuf);
}

export async function GET(req: Request): Promise<NextResponse> {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return new NextResponse("CRON_SECRET is not configured", { status: 500 });
  }

  const authHeader = req.headers.get("Authorization");
  if (!isAuthorizedCronRequest(authHeader, cronSecret)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const today = getTodayISO();
  const maxLeadDate = addDaysISO(today, 365);

  const snapshot = await getAdminDb()
    .collection("sentinels")
    .where("status", "==", "PENDING")
    .where("triggerDate", "<=", maxLeadDate)
    .get();

  let processedCount = 0;

  const promises = snapshot.docs.map(async (doc) => {
    const data = doc.data() as Sentinel;
    const leadTimeDays =
      Array.isArray(data.leadTimeDays) && data.leadTimeDays.length > 0
        ? data.leadTimeDays
        : [...DEFAULT_LEAD_TIME_DAYS];
    const notifiedWindows = Array.isArray(data.notifiedWindows)
      ? data.notifiedWindows
      : [];

    const dueWindow = getDueReminderWindow(
      data.triggerDate,
      today,
      leadTimeDays,
      notifiedWindows
    );

    if (dueWindow === null) {
      return;
    }

    processedCount += 1;
    const attemptIso = new Date().toISOString();

    const outcome = await deliverSentinelNotification({
      notificationMethod: data.notificationMethod,
      notificationTarget: data.notificationTarget,
      eventName: data.eventName,
      triggerDate: data.triggerDate,
      originalClause: data.originalClause,
      propertyLabel: data.propertyLabel,
      windowDays: dueWindow,
    });

    if (outcome.success) {
      const skippedLargerWindows = leadTimeDays.filter((w) => w >= dueWindow);
      const updatedWindows = Array.from(
        new Set([...notifiedWindows, ...skippedLargerWindows, dueWindow])
      ).sort((a, b) => b - a);

      const updatePayload: Record<string, unknown> = {
        notifiedWindows: updatedWindows,
        lastAttemptAt: attemptIso,
        updatedAt: new Date(),
      };

      if (dueWindow === 0) {
        updatePayload.status = "FIRED";
      }

      await doc.ref.update(updatePayload);

      const logData = LogSchema.parse({
        sentinelId: doc.id,
        userId: data.userId,
        firedAt: attemptIso,
        status: "SUCCESS",
        payload: {
          method: data.notificationMethod,
          provider: outcome.provider,
          event: data.eventName,
          date: data.triggerDate,
          windowDays: dueWindow,
        },
      });

      await getAdminDb().collection("logs").add(logData);
    } else {
      console.warn(`Failed to dispatch alert for sentinel ${doc.id}`);
      await doc.ref.update({ lastAttemptAt: attemptIso });

      const logData = LogSchema.parse({
        sentinelId: doc.id,
        userId: data.userId,
        firedAt: attemptIso,
        status: "FAILED",
        payload: {
          method: data.notificationMethod,
          provider: outcome.provider,
          event: data.eventName,
          date: data.triggerDate,
          windowDays: dueWindow,
          error: outcome.error || "Alert dispatch failed",
        },
      });

      await getAdminDb().collection("logs").add(logData);
    }
  });

  await Promise.allSettled(promises);

  return NextResponse.json({
    success: true,
    processed: processedCount,
  });
}
