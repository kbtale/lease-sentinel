"use server";

import { auth } from "@/auth";
import { isAdminEmail } from "@/lib/admin";

interface AdminResult {
  success: boolean;
  message: string;
  data?: {
    processed?: number;
  };
}

export async function triggerCronManual(): Promise<AdminResult> {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return {
        success: false,
        message: "Unauthorized. Please sign in.",
      };
    }

    if (!isAdminEmail(session.user.email)) {
      return {
        success: false,
        message: "Forbidden. Admin access required.",
      };
    }

    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
      return {
        success: false,
        message: "CRON_SECRET is not configured",
      };
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
    const response = await fetch(`${baseUrl}/api/cron/check`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${cronSecret}`,
      },
    });

    if (!response.ok) {
      const text = await response.text();
      return {
        success: false,
        message: `Cron trigger failed: ${response.status} - ${text}`,
      };
    }

    const data = await response.json();

    return {
      success: true,
      message: `Cron job completed. Processed ${data.processed || 0} sentinels.`,
      data: {
        processed: data.processed || 0,
      },
    };
  } catch (error) {
    console.error("Failed to trigger cron:", error);

    return {
      success: false,
      message: error instanceof Error ? error.message : "Failed to trigger cron job",
    };
  }
}
