import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase";
import { dispatchAlert } from "@/lib/webhook";
import { getTodayISO } from "@/lib/date-utils";
import { LogSchema, Sentinel } from "@/models/schema";

// I force dynamic rendering because Firebase credentials are not available at build time
export const dynamic = "force-dynamic";

/**
 * Cron API Route - Processes pending sentinels and dispatches webhook alerts.
 * I designed this to be called daily by Vercel Cron at midnight UTC.
 */
export async function GET(req: Request): Promise<NextResponse> {
  // Security gate - verify CRON_SECRET
  const authHeader = req.headers.get("Authorization");
  const expectedAuth = `Bearer ${process.env.CRON_SECRET}`;

  if (authHeader !== expectedAuth) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const today = getTodayISO();

  // Query sentinels where triggerDate matches today AND status is PENDING
  const snapshot = await getAdminDb()
    .collection("sentinels")
    .where("triggerDate", "==", today)
    .where("status", "==", "PENDING")
    .get();

  // I use allSettled so that one crash doesn't stop other alerts from firing.
  const promises = snapshot.docs.map(async (doc) => {
    const data = doc.data() as Sentinel;

    const isSuccess = await dispatchAlert(data.webhookUrl, {
      event: data.eventName,
      date: data.triggerDate,
    });

    if (isSuccess) {
      // Update sentinel status to FIRED
      await doc.ref.update({ status: "FIRED" });

      // Create success log entry
      const logData = LogSchema.parse({
        sentinelId: doc.id,
        firedAt: new Date().toISOString(),
        status: "SUCCESS",
        payload: {
          event: data.eventName,
          date: data.triggerDate,
        },
      });

      await getAdminDb().collection("logs").add(logData);
    } else {
      // Log warning but leave status as PENDING for retry on next run
      console.warn(`Failed to dispatch alert for sentinel ${doc.id}`);

      // Create failure log entry
      const logData = LogSchema.parse({
        sentinelId: doc.id,
        firedAt: new Date().toISOString(),
        status: "FAILED",
        payload: {
          event: data.eventName,
          date: data.triggerDate,
          error: "Webhook dispatch failed",
        },
      });

      await getAdminDb().collection("logs").add(logData);
    }
  });

  await Promise.allSettled(promises);

  return NextResponse.json({
    success: true,
    processed: snapshot.docs.length,
  });
}
