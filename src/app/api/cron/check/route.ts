import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase";
import { dispatchAlert } from "@/lib/webhook";
import { getTodayISO } from "@/lib/date-utils";
import { LogSchema, Sentinel } from "@/models/schema";

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

  const makeWebhookUrl = process.env.MAKE_WEBHOOK_URL;
  const makeApiKey = process.env.MAKE_API_KEY;
  const today = getTodayISO();

  const snapshot = await getAdminDb()
    .collection("sentinels")
    .where("status", "==", "PENDING")
    .where("triggerDate", "<=", today)
    .get();

  let processedCount = 0;

  const promises = snapshot.docs.map(async (doc) => {
    const data = doc.data() as Sentinel & {
      notifiedWindows?: number[];
      lastAttemptAt?: string;
    };
    const notifiedWindows = Array.isArray(data.notifiedWindows) ? data.notifiedWindows : [];

    if (notifiedWindows.includes(0)) {
      return;
    }

    processedCount += 1;
    const attemptIso = new Date().toISOString();

    let dispatchUrl: string;
    let payload: Record<string, unknown>;
    let headers: Record<string, string> | undefined;

    if (data.notificationMethod === "custom") {
      dispatchUrl = data.notificationTarget;
      payload = {
        event: data.eventName,
        date: data.triggerDate,
        clause: data.originalClause,
      };
    } else if (data.notificationMethod === "slack" && !makeWebhookUrl) {
      dispatchUrl = data.notificationTarget;
      payload = {
        text: `LeaseSentinel Alert: ${data.eventName} (Due ${data.triggerDate})\n${data.originalClause}`,
        event: data.eventName,
        date: data.triggerDate,
        clause: data.originalClause,
      };
    } else {
      if (!makeWebhookUrl) {
        console.error("MAKE_WEBHOOK_URL not configured - skipping notification");
        await doc.ref.update({ lastAttemptAt: attemptIso });
        const logData = LogSchema.parse({
          sentinelId: doc.id,
          userId: data.userId,
          firedAt: attemptIso,
          status: "FAILED",
          payload: {
            method: data.notificationMethod,
            event: data.eventName,
            date: data.triggerDate,
            error: "MAKE_WEBHOOK_URL not configured",
          },
        });
        await getAdminDb().collection("logs").add(logData);
        return;
      }
      dispatchUrl = makeWebhookUrl;
      payload = {
        method: data.notificationMethod,
        handle: data.notificationTarget,
        event: data.eventName,
        date: data.triggerDate,
        clause: data.originalClause,
      };
      if (makeApiKey) {
        headers = { "x-make-apikey": makeApiKey };
      }
    }

    const isSuccess = await dispatchAlert(dispatchUrl, payload, headers);

    if (isSuccess) {
      await doc.ref.update({
        status: "FIRED",
        notifiedWindows: [...notifiedWindows, 0],
        lastAttemptAt: attemptIso,
      });

      const logData = LogSchema.parse({
        sentinelId: doc.id,
        userId: data.userId,
        firedAt: attemptIso,
        status: "SUCCESS",
        payload: {
          method: data.notificationMethod,
          event: data.eventName,
          date: data.triggerDate,
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
    processed: processedCount,
  });
}
