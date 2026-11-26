import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { POST, resetDemoRateLimit } from "../route";

describe("POST /api/demo/extract", () => {
  beforeEach(() => {
    resetDemoRateLimit();
    vi.stubEnv("GOOGLE_API_KEY", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("extracts structured deadlines without authentication or Firestore writes", async () => {
    const req = new Request("https://app.example.com/api/demo/extract", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-forwarded-for": "203.0.113.10",
      },
      body: JSON.stringify({
        text: "Tenant must deliver written renewal notice 90 days prior to December 31, 2026.",
      }),
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.deadlines.length).toBeGreaterThan(0);
    expect(body.deadlines[0].triggerDate).toBe("2026-10-02");
  });

  it("rejects overly short lease text with 400", async () => {
    const req = new Request("https://app.example.com/api/demo/extract", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-forwarded-for": "203.0.113.11",
      },
      body: JSON.stringify({ text: "Too short" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("enforces per-IP rate limiting", async () => {
    const makeReq = () =>
      new Request("https://app.example.com/api/demo/extract", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-forwarded-for": "203.0.113.99",
        },
        body: JSON.stringify({
          text: "Notice must be provided 30 days prior to November 30, 2026.",
        }),
      });

    for (let i = 0; i < 10; i++) {
      const okRes = await POST(makeReq());
      expect(okRes.status).toBe(200);
    }

    const limitedRes = await POST(makeReq());
    expect(limitedRes.status).toBe(429);
  });
});
