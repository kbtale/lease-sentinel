"use server";

/**
 * Admin actions for system operations.
 * These are server-side only and never expose secrets to the client.
 */

interface AdminResult {
  success: boolean;
  message: string;
  data?: {
    processed?: number;
  };
}

/**
 * Manually triggers the cron job to process pending sentinels.
 * Server-side action that keeps CRON_SECRET private.
 * 
 * @returns Result object with success status and processed count.
 */
export async function triggerCronManual(): Promise<AdminResult> {
  try {
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret) {
      throw new Error("CRON_SECRET is not configured");
    }

    // Server-side fetch keeps the secret private
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
