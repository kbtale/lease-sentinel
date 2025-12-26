/**
 * Webhook dispatcher for sending alerts to external systems.
 * 
 * @remarks
 * This module handles outbound HTTP notifications to user-configured endpoints
 * (Slack, Discord, CRM systems, etc.). It enforces timeout safety to prevent
 * slow external services from blocking batch processing.
 * 
 * @module
 * @category Utilities
 */

/**
 * Dispatches an alert payload to an external webhook URL.
 * 
 * @summary Sends JSON payload to external HTTP endpoint with timeout protection.
 * @category Utilities
 * 
 * @security
 * **Outbound Only**: This function only makes outbound HTTP requests. It does not
 * receive or process incoming webhooks.
 * 
 * **No Credential Exposure**: The payload is constructed by the caller. This function
 * does not include any server-side secrets in the request.
 * 
 * @remarks
 * Uses `AbortController` with a 5-second timeout to prevent slow external services
 * from stalling the cron batch job. In a serverless environment like Vercel, function
 * execution time is limited—a single unresponsive webhook could cause timeout for
 * all remaining sentinels in the batch.
 * 
 * The function returns a boolean rather than throwing to enable graceful degradation:
 * if one webhook fails, the cron job can continue processing other sentinels.
 * 
 * @param url - The external webhook URL to send the payload to.
 *   Must be a valid HTTP/HTTPS URL.
 * @param payload - The JSON data to send as the request body.
 *   Typically includes sentinel details like `eventName`, `triggerDate`, etc.
 * 
 * @returns Promise resolving to `true` if delivery succeeded (HTTP 2xx),
 *   `false` if delivery failed (network error, timeout, or non-2xx response).
 * 
 * @example
 * ```typescript
 * // Cron job usage
 * import { dispatchAlert } from "@/lib/webhook";
 * 
 * const success = await dispatchAlert(sentinel.webhookUrl, {
 *   event: sentinel.eventName,
 *   triggerDate: sentinel.triggerDate,
 *   message: `Deadline "${sentinel.eventName}" has been triggered.`,
 * });
 * 
 * if (!success) {
 *   // Log failure, retry later, or notify admin
 * }
 * ```
 * 
 * @see {@link LogSchema} for tracking dispatch results.
 */
export async function dispatchAlert(
  url: string,
  payload: Record<string, unknown>
): Promise<boolean> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error(
        `Webhook delivery failed for ${url}: HTTP ${response.status}`
      );
      return false;
    }

    return true;
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof Error && error.name === "AbortError") {
      console.error(`Webhook timeout for ${url}: Request exceeded 5s limit`);
    } else {
      console.error(`Webhook error for ${url}:`, error);
    }

    return false;
  }
}
