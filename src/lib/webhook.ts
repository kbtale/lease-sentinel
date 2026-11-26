import crypto from "node:crypto";
import { validateWebhookUrl } from "@/lib/url-safety";

export interface DispatchAlertOptions {
  signingSecret?: string;
}

export function signWebhookPayload(body: string, secret: string): string {
  const digest = crypto.createHmac("sha256", secret).update(body).digest("hex");
  return `sha256=${digest}`;
}

export async function dispatchAlert(
  url: string,
  payload: Record<string, unknown>,
  headers?: Record<string, string>,
  options?: DispatchAlertOptions
): Promise<boolean> {
  const safety = await validateWebhookUrl(url);
  if (!safety.valid) {
    console.error(`Blocked unsafe webhook URL ${url}: ${safety.reason}`);
    return false;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);
  const body = JSON.stringify(payload);
  const signingSecret = options?.signingSecret ?? process.env.WEBHOOK_SIGNING_SECRET;
  const requestHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    ...headers,
  };

  if (signingSecret) {
    requestHeaders["X-LeaseSentinel-Signature"] = signWebhookPayload(body, signingSecret);
  }

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: requestHeaders,
      body,
      redirect: "error",
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
