import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockSend = vi.fn();

vi.mock("resend", () => ({
  Resend: class MockResend {
    emails = {
      send: mockSend,
    };
  },
}));

import { sendDeadlineEmail, buildDeadlineEmailHtml } from "../email";

describe("email delivery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("RESEND_API_KEY", "re_test_123");
    vi.stubEnv("RESEND_FROM_EMAIL", "LeaseSentinel <alerts@leasesentinel.app>");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("escapes HTML special characters in email body", () => {
    const html = buildDeadlineEmailHtml({
      eventName: "<script>alert(1)</script> Renewal",
      triggerDate: "2026-08-01",
      originalClause: "Clause with <b>tags</b> & quotes",
      propertyLabel: "Unit <4B>",
      reminderLabel: "7-day reminder",
    });

    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).toContain("Unit &lt;4B&gt;");
    expect(html).toContain("7-day reminder");
  });

  it("delivers email directly via Resend using RESEND_FROM_EMAIL", async () => {
    mockSend.mockResolvedValueOnce({ data: { id: "email-id-1" }, error: null });

    const result = await sendDeadlineEmail({
      to: "landlord@example.com",
      eventName: "Lease Renewal Deadline",
      triggerDate: "2026-08-01",
      originalClause: "Notice due 60 days prior.",
      propertyLabel: "100 Broadway",
    });

    expect(result.success).toBe(true);
    expect(result.id).toBe("email-id-1");
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        from: "LeaseSentinel <alerts@leasesentinel.app>",
        to: ["landlord@example.com"],
        subject: expect.stringContaining("Lease Renewal Deadline"),
      })
    );
  });

  it("returns error gracefully when RESEND_API_KEY is missing", async () => {
    vi.stubEnv("RESEND_API_KEY", "");

    const result = await sendDeadlineEmail({
      to: "landlord@example.com",
      eventName: "Lease Renewal",
      triggerDate: "2026-08-01",
      originalClause: "Notice due.",
    });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/RESEND_API_KEY/i);
    expect(mockSend).not.toHaveBeenCalled();
  });
});
