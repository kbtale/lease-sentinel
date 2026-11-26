import { Resend } from "resend";

export interface DeadlineEmailParams {
  to: string;
  eventName: string;
  triggerDate: string;
  originalClause: string;
  propertyLabel?: string;
  reminderLabel?: string;
  isTest?: boolean;
}

export interface EmailDeliveryResult {
  success: boolean;
  id?: string;
  error?: string;
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function buildDeadlineEmailHtml(
  params: Omit<DeadlineEmailParams, "to">
): string {
  const title = escapeHtml(params.eventName);
  const date = escapeHtml(params.triggerDate);
  const clause = escapeHtml(params.originalClause);
  const property = params.propertyLabel ? escapeHtml(params.propertyLabel) : null;
  const badgeText = escapeHtml(
    params.isTest
      ? "Test Alert"
      : params.reminderLabel || "Deadline Due"
  );

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title}</title>
  </head>
  <body style="margin:0;padding:24px;background-color:#09090b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#fafafa;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;margin:0 auto;background-color:#18181b;border:1px solid #27272a;border-radius:12px;overflow:hidden;">
      <tr>
        <td style="padding:24px 28px;border-bottom:1px solid #27272a;">
          <div style="font-size:12px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#a1a1aa;">LeaseSentinel Alert</div>
          <div style="margin-top:8px;display:inline-block;padding:4px 10px;border-radius:9999px;background-color:#312e81;color:#c7d2fe;font-size:12px;font-weight:600;">${badgeText}</div>
          <h1 style="margin:14px 0 0;font-size:22px;line-height:1.3;color:#fafafa;">${title}</h1>
        </td>
      </tr>
      <tr>
        <td style="padding:24px 28px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom:20px;">
            <tr>
              <td style="padding:8px 0;color:#a1a1aa;font-size:13px;width:130px;">Trigger Date</td>
              <td style="padding:8px 0;color:#fafafa;font-size:14px;font-weight:600;font-family:monospace;">${date}</td>
            </tr>
            ${
              property
                ? `<tr>
              <td style="padding:8px 0;color:#a1a1aa;font-size:13px;">Property</td>
              <td style="padding:8px 0;color:#fafafa;font-size:14px;">${property}</td>
            </tr>`
                : ""
            }
          </table>
          <div style="padding:16px;background-color:#09090b;border:1px solid #27272a;border-radius:8px;">
            <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;color:#71717a;margin-bottom:8px;">Lease Clause</div>
            <div style="font-size:13px;line-height:1.6;color:#d4d4d8;white-space:pre-wrap;">${clause}</div>
          </div>
        </td>
      </tr>
      <tr>
        <td style="padding:16px 28px;border-top:1px solid #27272a;font-size:12px;color:#71717a;">
          Sent automatically by LeaseSentinel deadline monitoring.
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export function buildDeadlineEmailText(
  params: Omit<DeadlineEmailParams, "to">
): string {
  const lines = [
    params.isTest ? "[TEST ALERT] LeaseSentinel" : "LeaseSentinel Deadline Alert",
    `Event: ${params.eventName}`,
    `Trigger Date: ${params.triggerDate}`,
  ];
  if (params.propertyLabel) {
    lines.push(`Property: ${params.propertyLabel}`);
  }
  if (params.reminderLabel) {
    lines.push(`Window: ${params.reminderLabel}`);
  }
  lines.push("", "Lease Clause:", params.originalClause);
  return lines.join("\n");
}

export async function sendDeadlineEmail(
  params: DeadlineEmailParams
): Promise<EmailDeliveryResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    return {
      success: false,
      error: "RESEND_API_KEY is not configured",
    };
  }

  const from =
    process.env.RESEND_FROM_EMAIL?.trim() ||
    "LeaseSentinel <onboarding@resend.dev>";

  const prefix = params.isTest
    ? "[Test] "
    : params.reminderLabel
      ? `[${params.reminderLabel}] `
      : "";
  const subject = `${prefix}${params.eventName} (${params.triggerDate})`;

  try {
    const resend = new Resend(apiKey);
    const response = await resend.emails.send({
      from,
      to: [params.to],
      subject,
      html: buildDeadlineEmailHtml(params),
      text: buildDeadlineEmailText(params),
    });

    if (response.error) {
      return {
        success: false,
        error: response.error.message || "Resend email delivery failed",
      };
    }

    return {
      success: true,
      id: response.data?.id,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Email delivery failed",
    };
  }
}
