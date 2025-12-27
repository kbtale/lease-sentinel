import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase";
import { dispatchAlert } from "@/lib/webhook";
import { getTodayISO } from "@/lib/date-utils";
import { LogSchema, Sentinel } from "@/models/schema";

// Force dynamic rendering - Firebase credentials unavailable at build time
export const dynamic = "force-dynamic";

// Central dispatcher webhook for Slack/Teams/Email/SMS routing
const MAKE_WEBHOOK_URL = process.env.MAKE_WEBHOOK_URL;

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

  // allSettled ensures one crash doesn't stop other alerts from firing
  const promises = snapshot.docs.map(async (doc) => {
    const data = doc.data() as Sentinel;

    // Determine dispatch URL and payload based on notification method
    let dispatchUrl: string;
    let payload: Record<string, unknown>;

    if (data.notificationMethod === "custom") {
      // Custom webhook - send directly to user's URL
      dispatchUrl = data.notificationTarget;
      payload = {
        event: data.eventName,
        date: data.triggerDate,
        clause: data.originalClause,
      };
    } else {
      // Slack/Teams/Email/SMS - route through Make.com dispatcher
      if (!MAKE_WEBHOOK_URL) {
        console.error("MAKE_WEBHOOK_URL not configured - skipping non-custom notifications");
        return;
      }
      dispatchUrl = MAKE_WEBHOOK_URL;
      payload = {
        method: data.notificationMethod,
        handle: data.notificationTarget, // email or phone depending on method
        event: data.eventName,
        date: data.triggerDate,
        clause: data.originalClause,
      };
    }

    const isSuccess = await dispatchAlert(dispatchUrl, payload);

    if (isSuccess) {
      // Update sentinel status to FIRED
      await doc.ref.update({ status: "FIRED" });

      // Create success log entry
      const logData = LogSchema.parse({
        sentinelId: doc.id,
        firedAt: new Date().toISOString(),
        status: "SUCCESS",
        payload: {
          method: data.notificationMethod,
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
          method: data.notificationMethod,
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
