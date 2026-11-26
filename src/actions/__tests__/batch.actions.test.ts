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

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { lookup } from "node:dns/promises";
import { auth } from "@/auth";
import { getAdminDb } from "@/lib/firebase";
import { createSentinelsBatch } from "../sentinel.actions";

function createBatchDb() {
  const mockSet = vi.fn();
  const mockCommit = vi.fn().mockResolvedValue(undefined);
  const mockDoc = vi.fn(() => ({ id: "generated-id" }));
  const mockBatch = vi.fn(() => ({
    set: mockSet,
    commit: mockCommit,
  }));
  const mockCollection = vi.fn(() => ({
    doc: mockDoc,
  }));

  return {
    batch: mockBatch,
    collection: mockCollection,
    _mocks: { mockSet, mockCommit, mockDoc, mockBatch },
  };
}

describe("createSentinelsBatch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (lookup as Mock).mockResolvedValue([{ address: "93.184.216.34", family: 4 }]);
  });

  it("rejects unauthenticated requests", async () => {
    (auth as Mock).mockResolvedValue(null);

    const res = await createSentinelsBatch([
      {
        eventName: "Renewal Notice",
        triggerDate: "2026-09-01",
        originalClause: "Notice due 60 days prior.",
        notificationMethod: "email",
        notificationTarget: "owner@example.com",
        leadTimeDays: [30, 7, 0],
      },
    ]);

    expect(res.success).toBe(false);
    expect(res.message).toMatch(/unauthorized/i);
  });

  it("rejects batch containing SSRF webhook targets", async () => {
    (auth as Mock).mockResolvedValue({ user: { email: "owner@example.com" } });
    const db = createBatchDb();
    (getAdminDb as Mock).mockReturnValue(db);

    const res = await createSentinelsBatch([
      {
        eventName: "Renewal Notice",
        triggerDate: "2026-09-01",
        originalClause: "Notice due 60 days prior.",
        notificationMethod: "custom",
        notificationTarget: "https://169.254.169.254/latest/meta-data/",
        leadTimeDays: [30, 7, 0],
      },
    ]);

    expect(res.success).toBe(false);
    expect(db._mocks.mockCommit).not.toHaveBeenCalled();
  });

  it("commits multiple valid sentinels tagged with authenticated userId", async () => {
    (auth as Mock).mockResolvedValue({ user: { email: "landlord@example.com" } });
    const db = createBatchDb();
    (getAdminDb as Mock).mockReturnValue(db);

    const res = await createSentinelsBatch([
      {
        eventName: "Renewal Notice Deadline",
        propertyLabel: "Suite 200",
        triggerDate: "2026-09-01",
        originalClause: "Tenant must give 60 days notice.",
        notificationMethod: "email",
        notificationTarget: "landlord@example.com",
        leadTimeDays: [30, 7, 0],
      },
      {
        eventName: "Annual Rent Escalation",
        propertyLabel: "Suite 200",
        triggerDate: "2027-01-01",
        originalClause: "Rent increases by 3% on January 1, 2027.",
        notificationMethod: "custom",
        notificationTarget: "https://hooks.example.com/lease",
        leadTimeDays: [14, 0],
      },
    ]);

    expect(res.success).toBe(true);
    expect(res.data?.createdCount).toBe(2);
    expect(db._mocks.mockSet).toHaveBeenCalledTimes(2);
    expect(db._mocks.mockCommit).toHaveBeenCalledOnce();
    expect(db._mocks.mockSet.mock.calls[0][1].userId).toBe("landlord@example.com");
    expect(db._mocks.mockSet.mock.calls[1][1].userId).toBe("landlord@example.com");
  });
});
