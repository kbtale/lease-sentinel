import { describe, it, expect, vi, beforeEach, afterEach, Mock } from "vitest";

vi.mock("@/lib/firebase", () => ({
  getAdminDb: vi.fn(),
}));

vi.mock("@/lib/webhook", () => ({
  dispatchAlert: vi.fn(),
}));

vi.mock("@/lib/date-utils", () => ({
  getTodayISO: vi.fn(() => "2025-06-15"),
}));

import { getAdminDb } from "@/lib/firebase";
import { dispatchAlert } from "@/lib/webhook";
import { GET } from "../route";

function createCronMockDb(docs: Array<{
  id: string;
  data: Record<string, unknown>;
  update?: Mock;
}>) {
  const mockAdd = vi.fn().mockResolvedValue({ id: "log-1" });
  const wrappedDocs = docs.map((d) => ({
    id: d.id,
    data: () => d.data,
    ref: { update: d.update ?? vi.fn().mockResolvedValue(undefined) },
  }));

  const mockGet = vi.fn().mockResolvedValue({ docs: wrappedDocs });
  const mockWhere = vi.fn();
  const queryObj = { where: mockWhere, get: mockGet };
  mockWhere.mockReturnValue(queryObj);

  const mockCollection = vi.fn((name: string) => {
    if (name === "logs") {
      return { add: mockAdd };
    }
    return { where: mockWhere };
  });

  return {
    collection: mockCollection,
    _mocks: { mockWhere, mockGet, mockAdd, wrappedDocs },
  };
}

describe("GET /api/cron/check", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("CRON_SECRET", "exact-cron-secret");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("fails closed when CRON_SECRET is missing even if Bearer undefined is sent", async () => {
    vi.stubEnv("CRON_SECRET", "");
    const req = new Request("https://app.example.com/api/cron/check", {
      headers: { Authorization: "Bearer undefined" },
    });

    const res = await GET(req);

    expect(res.status).toBeGreaterThanOrEqual(401);
  });

  it("returns 401 when Authorization header does not match CRON_SECRET", async () => {
    const req = new Request("https://app.example.com/api/cron/check", {
      headers: { Authorization: "Bearer wrong-secret" },
    });

    const res = await GET(req);

    expect(res.status).toBe(401);
  });

  it("queries PENDING sentinels with triggerDate <= today so missed deadlines retry", async () => {
    const overdueUpdate = vi.fn().mockResolvedValue(undefined);
    const todayUpdate = vi.fn().mockResolvedValue(undefined);
    const mockDb = createCronMockDb([
      {
        id: "overdue-1",
        data: {
          userId: "owner@example.com",
          eventName: "Missed Renewal",
          triggerDate: "2025-06-14",
          originalClause: "Notice required by June 14",
          notificationMethod: "custom",
          notificationTarget: "https://hooks.example.com/alert",
          status: "PENDING",
          notifiedWindows: [],
        },
        update: overdueUpdate,
      },
      {
        id: "today-1",
        data: {
          userId: "owner@example.com",
          eventName: "Due Today",
          triggerDate: "2025-06-15",
          originalClause: "Notice required by June 15",
          notificationMethod: "custom",
          notificationTarget: "https://hooks.example.com/alert",
          status: "PENDING",
          notifiedWindows: [],
        },
        update: todayUpdate,
      },
    ]);
    (getAdminDb as Mock).mockReturnValue(mockDb);
    (dispatchAlert as Mock).mockResolvedValue(true);

    const req = new Request("https://app.example.com/api/cron/check", {
      headers: { Authorization: "Bearer exact-cron-secret" },
    });

    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.processed).toBe(2);
    expect(mockDb._mocks.mockWhere).toHaveBeenCalledWith("triggerDate", "<=", "2025-06-15");
    expect(mockDb._mocks.mockWhere).toHaveBeenCalledWith("status", "==", "PENDING");
    expect(overdueUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "FIRED",
        notifiedWindows: expect.arrayContaining([0]),
      })
    );
    expect(todayUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "FIRED",
        notifiedWindows: expect.arrayContaining([0]),
      })
    );
  });

  it("skips duplicate dispatch when window 0 is already recorded in notifiedWindows", async () => {
    const mockUpdate = vi.fn().mockResolvedValue(undefined);
    const mockDb = createCronMockDb([
      {
        id: "already-notified",
        data: {
          userId: "owner@example.com",
          eventName: "Already Sent",
          triggerDate: "2025-06-15",
          originalClause: "Already sent clause",
          notificationMethod: "custom",
          notificationTarget: "https://hooks.example.com/alert",
          status: "PENDING",
          notifiedWindows: [0],
        },
        update: mockUpdate,
      },
    ]);
    (getAdminDb as Mock).mockReturnValue(mockDb);

    const req = new Request("https://app.example.com/api/cron/check", {
      headers: { Authorization: "Bearer exact-cron-secret" },
    });

    const res = await GET(req);

    expect(res.status).toBe(200);
    expect(dispatchAlert).not.toHaveBeenCalled();
  });

  it("keeps sentinel PENDING with lastAttemptAt when delivery fails so next cron retries", async () => {
    const mockUpdate = vi.fn().mockResolvedValue(undefined);
    const mockDb = createCronMockDb([
      {
        id: "failing-1",
        data: {
          userId: "owner@example.com",
          eventName: "Retryable Deadline",
          triggerDate: "2025-06-15",
          originalClause: "Retry clause",
          notificationMethod: "custom",
          notificationTarget: "https://hooks.example.com/alert",
          status: "PENDING",
          notifiedWindows: [],
        },
        update: mockUpdate,
      },
    ]);
    (getAdminDb as Mock).mockReturnValue(mockDb);
    (dispatchAlert as Mock).mockResolvedValue(false);

    const req = new Request("https://app.example.com/api/cron/check", {
      headers: { Authorization: "Bearer exact-cron-secret" },
    });

    const res = await GET(req);

    expect(res.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        lastAttemptAt: expect.any(String),
      })
    );
    expect(mockUpdate).not.toHaveBeenCalledWith(
      expect.objectContaining({ status: "FIRED" })
    );
    expect(mockDb._mocks.mockAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        sentinelId: "failing-1",
        status: "FAILED",
      })
    );
  });
});
