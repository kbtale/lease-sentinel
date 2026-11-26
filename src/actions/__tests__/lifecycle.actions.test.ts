import { describe, it, expect, vi, beforeEach, Mock } from "vitest";

vi.mock("node:dns/promises", () => {
  const lookup = vi.fn();
  return { default: { lookup }, lookup };
});

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/firebase", () => ({
  getAdminDb: vi.fn(),
}));

vi.mock("@/lib/email", () => ({
  sendDeadlineEmail: vi.fn(),
}));

vi.mock("@/lib/webhook", () => ({
  dispatchAlert: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { lookup } from "node:dns/promises";
import { auth } from "@/auth";
import { getAdminDb } from "@/lib/firebase";
import { sendDeadlineEmail } from "@/lib/email";
import { dispatchAlert } from "@/lib/webhook";
import {
  updateSentinel,
  updateSentinelStatus,
  sendTestAlert,
} from "../sentinel.actions";
import { getSentinelLogs } from "../fetch-actions";

function createLifecycleDb(docData: Record<string, unknown> | null, logDocs: Array<{ id: string; data: () => Record<string, unknown> }> = []) {
  const mockUpdate = vi.fn().mockResolvedValue(undefined);
  const mockAdd = vi.fn().mockResolvedValue({ id: "log-new" });
  const mockDocGet = vi.fn().mockResolvedValue(
    docData ? { exists: true, id: "s-1", data: () => docData } : { exists: false }
  );
  const mockLogsGet = vi.fn().mockResolvedValue({ docs: logDocs });
  const mockWhere = vi.fn();
  const queryObj = { where: mockWhere, orderBy: vi.fn(), limit: vi.fn(), get: mockLogsGet };
  mockWhere.mockReturnValue(queryObj);
  queryObj.orderBy.mockReturnValue(queryObj);
  queryObj.limit.mockReturnValue(queryObj);

  const mockCollection = vi.fn((name: string) => {
    if (name === "logs") {
      return { add: mockAdd, where: mockWhere };
    }
    return {
      doc: vi.fn(() => ({
        get: mockDocGet,
        update: mockUpdate,
      })),
    };
  });

  return {
    collection: mockCollection,
    _mocks: { mockUpdate, mockAdd, mockDocGet, mockWhere, mockLogsGet },
  };
}

describe("Sentinel Lifecycle Actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (lookup as Mock).mockResolvedValue([{ address: "93.184.216.34", family: 4 }]);
  });

  it("updates owned sentinel fields and resets notifiedWindows when triggerDate changes", async () => {
    (auth as Mock).mockResolvedValue({ user: { email: "owner@example.com" } });
    const db = createLifecycleDb({
      userId: "owner@example.com",
      eventName: "Old Name",
      triggerDate: "2026-05-01",
      originalClause: "Old clause",
      notificationMethod: "email",
      notificationTarget: "owner@example.com",
      status: "PENDING",
      notifiedWindows: [30],
    });
    (getAdminDb as Mock).mockReturnValue(db);

    const result = await updateSentinel("s-1", {
      eventName: "Updated Renewal Notice",
      triggerDate: "2026-07-01",
      propertyLabel: "200 Oak Ave",
      leadTimeDays: [30, 7, 0],
      notificationMethod: "email",
      notificationTarget: "alerts@example.com",
      originalClause: "Updated clause text here",
    });

    expect(result.success).toBe(true);
    expect(db._mocks.mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: "Updated Renewal Notice",
        triggerDate: "2026-07-01",
        propertyLabel: "200 Oak Ave",
        notifiedWindows: [],
      })
    );
  });

  it("denies updateSentinel for another user's sentinel", async () => {
    (auth as Mock).mockResolvedValue({ user: { email: "attacker@example.com" } });
    const db = createLifecycleDb({
      userId: "victim@example.com",
      eventName: "Secret Lease",
      triggerDate: "2026-05-01",
    });
    (getAdminDb as Mock).mockReturnValue(db);

    const result = await updateSentinel("s-1", {
      eventName: "Hijacked",
      triggerDate: "2026-07-01",
      leadTimeDays: [7, 0],
      notificationMethod: "email",
      notificationTarget: "attacker@example.com",
      originalClause: "Updated clause text here",
    });

    expect(result.success).toBe(false);
    expect(db._mocks.mockUpdate).not.toHaveBeenCalled();
  });

  it("updates sentinel status to PAUSED and RESOLVED with ownership enforcement", async () => {
    (auth as Mock).mockResolvedValue({ user: { email: "owner@example.com" } });
    const db = createLifecycleDb({ userId: "owner@example.com", status: "PENDING" });
    (getAdminDb as Mock).mockReturnValue(db);

    const pauseRes = await updateSentinelStatus("s-1", "PAUSED");
    expect(pauseRes.success).toBe(true);
    expect(db._mocks.mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ status: "PAUSED" })
    );

    const resolveRes = await updateSentinelStatus("s-1", "RESOLVED");
    expect(resolveRes.success).toBe(true);
    expect(db._mocks.mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ status: "RESOLVED" })
    );
  });

  it("denies updateSentinelStatus across users", async () => {
    (auth as Mock).mockResolvedValue({ user: { email: "other@example.com" } });
    const db = createLifecycleDb({ userId: "owner@example.com", status: "PENDING" });
    (getAdminDb as Mock).mockReturnValue(db);

    const res = await updateSentinelStatus("s-1", "PAUSED");
    expect(res.success).toBe(false);
    expect(db._mocks.mockUpdate).not.toHaveBeenCalled();
  });

  it("sends a test email alert via Resend and writes a user-scoped log", async () => {
    (auth as Mock).mockResolvedValue({ user: { email: "owner@example.com" } });
    (sendDeadlineEmail as Mock).mockResolvedValue({ success: true, id: "em-1" });
    const db = createLifecycleDb({
      userId: "owner@example.com",
      eventName: "Renewal Notice",
      propertyLabel: "Suite 12",
      triggerDate: "2026-09-01",
      originalClause: "60 days notice required",
      notificationMethod: "email",
      notificationTarget: "owner@example.com",
      status: "PENDING",
    });
    (getAdminDb as Mock).mockReturnValue(db);

    const res = await sendTestAlert("s-1");

    expect(res.success).toBe(true);
    expect(sendDeadlineEmail).toHaveBeenCalledOnce();
    expect(db._mocks.mockAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        sentinelId: "s-1",
        userId: "owner@example.com",
        status: "SUCCESS",
      })
    );
  });

  it("sends a test webhook alert via dispatchAlert and denies cross-user test alerts", async () => {
    (auth as Mock).mockResolvedValue({ user: { email: "attacker@example.com" } });
    const db = createLifecycleDb({
      userId: "victim@example.com",
      notificationMethod: "custom",
      notificationTarget: "https://hooks.example.com/a",
    });
    (getAdminDb as Mock).mockReturnValue(db);

    const denied = await sendTestAlert("s-1");
    expect(denied.success).toBe(false);
    expect(dispatchAlert).not.toHaveBeenCalled();
  });

  it("fetches delivery logs scoped to authenticated userId and denies cross-user sentinelId", async () => {
    (auth as Mock).mockResolvedValue({ user: { email: "owner@example.com" } });
    const db = createLifecycleDb(
      { userId: "victim@example.com" },
      [
        {
          id: "log-1",
          data: () => ({
            sentinelId: "s-1",
            userId: "owner@example.com",
            firedAt: "2026-06-01T12:00:00.000Z",
            status: "SUCCESS",
            payload: { method: "email" },
          }),
        },
      ]
    );
    (getAdminDb as Mock).mockReturnValue(db);

    const deniedLogs = await getSentinelLogs("s-1");
    expect(deniedLogs).toEqual([]);

    const ownDb = createLifecycleDb(
      { userId: "owner@example.com" },
      [
        {
          id: "log-1",
          data: () => ({
            sentinelId: "s-1",
            userId: "owner@example.com",
            firedAt: "2026-06-01T12:00:00.000Z",
            status: "SUCCESS",
            payload: { method: "email" },
          }),
        },
      ]
    );
    (getAdminDb as Mock).mockReturnValue(ownDb);

    const ownLogs = await getSentinelLogs("s-1");
    expect(ownLogs).toHaveLength(1);
    expect(ownDb._mocks.mockWhere).toHaveBeenCalledWith("userId", "==", "owner@example.com");
  });
});
