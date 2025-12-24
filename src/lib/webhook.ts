/**
 * Webhook dispatcher for sending alerts to external systems (Slack/Discord/CRM).
 * I use native fetch with AbortController for timeout safety in serverless environments.
 */

/**
 * Dispatches an alert payload to an external webhook URL.
 * I enforce a 5s timeout to prevent a single slow webhook from stalling the entire batch job.
 * 
 * @param url - The external webhook URL to send the payload to.
 * @param payload - The JSON data to send as the request body.
 * @returns Promise resolving to true if delivery succeeded, false otherwise.
 */
export async function dispatchAlert(
  url: string,
  payload: Record<string, unknown>
): Promise<boolean> {
  // I enforce a 5s timeout to prevent a single slow webhook from stalling the entire batch job.
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
