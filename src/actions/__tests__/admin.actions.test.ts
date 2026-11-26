import { describe, it, expect, vi, beforeEach, afterEach, Mock } from "vitest";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

import { auth } from "@/auth";
import { triggerCronManual } from "../admin.actions";

const originalFetch = global.fetch;

describe("triggerCronManual", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
    vi.stubEnv("CRON_SECRET", "super-secret-cron-token");
    vi.stubEnv("ADMIN_EMAILS", "admin@example.com, ops@example.com");
    vi.stubEnv("NEXT_PUBLIC_BASE_URL", "https://app.example.com");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    global.fetch = originalFetch;
  });

  it("rejects unauthenticated callers", async () => {
    (auth as Mock).mockResolvedValue(null);

    const result = await triggerCronManual();

    expect(result.success).toBe(false);
    expect(result.message).toMatch(/unauthorized/i);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("rejects authenticated non-admin callers", async () => {
    (auth as Mock).mockResolvedValue({ user: { email: "user@example.com" } });

    const result = await triggerCronManual();

    expect(result.success).toBe(false);
    expect(result.message).toMatch(/forbidden|admin/i);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("fails closed when ADMIN_EMAILS is unset", async () => {
    vi.stubEnv("ADMIN_EMAILS", "");
    (auth as Mock).mockResolvedValue({ user: { email: "admin@example.com" } });

    const result = await triggerCronManual();

    expect(result.success).toBe(false);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("allows allowlisted admin callers case-insensitively", async () => {
    (auth as Mock).mockResolvedValue({ user: { email: "ADMIN@EXAMPLE.COM" } });
    (global.fetch as Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, processed: 2 }),
    });

    const result = await triggerCronManual();

    expect(result.success).toBe(true);
    expect(result.data?.processed).toBe(2);
    expect(global.fetch).toHaveBeenCalledWith(
      "https://app.example.com/api/cron/check",
      expect.objectContaining({
        method: "GET",
        headers: {
          Authorization: "Bearer super-secret-cron-token",
        },
      })
    );
  });
});
