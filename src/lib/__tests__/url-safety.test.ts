import { describe, it, expect, vi } from "vitest";
import { validateWebhookUrl, validateNotificationTarget } from "../url-safety";

describe("url-safety", () => {
  describe("validateWebhookUrl", () => {
    const publicLookup = vi.fn(async () => [{ address: "93.184.216.34", family: 4 }]);

    it("accepts public HTTPS URLs", async () => {
      const result = await validateWebhookUrl(
        "https://hooks.slack.com/services/T000/B000/XXX",
        publicLookup
      );
      expect(result.valid).toBe(true);
    });

    it("rejects non-HTTPS URLs", async () => {
      const result = await validateWebhookUrl("http://hooks.slack.com/test", publicLookup);
      expect(result.valid).toBe(false);
    });

    it("rejects loopback, private RFC1918, and cloud metadata IPs", async () => {
      const blockedUrls = [
        "https://127.0.0.1/hook",
        "https://localhost/hook",
        "https://[::1]/hook",
        "https://0.0.0.0/hook",
        "https://10.0.0.1/hook",
        "https://172.16.0.1/hook",
        "https://192.168.1.1/hook",
        "https://169.254.169.254/latest/meta-data/",
        "https://[fe80::1]/hook",
        "https://[fc00::1]/hook",
        "https://[::ffff:127.0.0.1]/hook",
        "https://[::ffff:169.254.169.254]/hook",
      ];

      for (const url of blockedUrls) {
        const result = await validateWebhookUrl(url, publicLookup);
        expect(result.valid, `expected ${url} to be blocked`).toBe(false);
      }
    });

    it("rejects hostnames that resolve via DNS to private or metadata IPs", async () => {
      const evilLookup = vi.fn(async () => [{ address: "169.254.169.254", family: 4 }]);
      const result = await validateWebhookUrl("https://evil.example.com/hook", evilLookup);
      expect(result.valid).toBe(false);
    });

    it("rejects hostnames when DNS resolution fails", async () => {
      const failingLookup = vi.fn(async () => {
        throw new Error("ENOTFOUND");
      });
      const result = await validateWebhookUrl("https://nonexistent.invalid/hook", failingLookup);
      expect(result.valid).toBe(false);
    });
  });

  describe("validateNotificationTarget", () => {
    const publicLookup = vi.fn(async () => [{ address: "93.184.216.34", family: 4 }]);

    it("validates email targets strictly", async () => {
      expect((await validateNotificationTarget("email", "landlord@example.com")).valid).toBe(true);
      expect((await validateNotificationTarget("email", "not-an-email")).valid).toBe(false);
      expect((await validateNotificationTarget("email", "https://example.com")).valid).toBe(false);
    });

    it("validates E.164 SMS targets strictly", async () => {
      expect((await validateNotificationTarget("sms", "+14155552671")).valid).toBe(true);
      expect((await validateNotificationTarget("sms", "415-555-2671")).valid).toBe(false);
      expect((await validateNotificationTarget("sms", "abc")).valid).toBe(false);
    });

    it("validates custom and slack targets as safe HTTPS URLs", async () => {
      expect(
        (await validateNotificationTarget("custom", "https://hooks.example.com/a", publicLookup))
          .valid
      ).toBe(true);
      expect(
        (
          await validateNotificationTarget(
            "slack",
            "https://hooks.slack.com/services/T1/B1/X1",
            publicLookup
          )
        ).valid
      ).toBe(true);
      expect(
        (await validateNotificationTarget("slack", "user@example.com", publicLookup)).valid
      ).toBe(false);
      expect(
        (await validateNotificationTarget("custom", "http://169.254.169.254/", publicLookup)).valid
      ).toBe(false);
    });
  });
});
