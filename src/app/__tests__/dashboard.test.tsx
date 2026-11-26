import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import type { Sentinel } from "@/models/schema";

vi.mock("@/actions/sentinel.actions", () => ({
  createSentinel: vi.fn(),
  deleteSentinel: vi.fn(),
  updateSentinel: vi.fn(),
  updateSentinelStatus: vi.fn(),
  sendTestAlert: vi.fn(),
  extractLeaseDocumentAction: vi.fn(),
  createSentinelsBatch: vi.fn(),
}));

vi.mock("@/actions/fetch-actions", () => ({
  getSentinelLogs: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/actions/auth.actions", () => ({
  logoutAction: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe("DashboardShell", () => {
  const mockUser = {
    name: "Test Bot",
    email: "test@example.com",
    image: "https://example.com/avatar.png",
  };

  const sampleSentinels: Sentinel[] = [
    {
      id: "1",
      userId: "test@example.com",
      eventName: "Lease Renewal Notice",
      propertyLabel: "450 Market St",
      triggerDate: "2026-12-15",
      originalClause: "Tenant must give 60 days notice prior to expiration.",
      notificationMethod: "email",
      notificationTarget: "test@example.com",
      status: "PENDING",
      leadTimeDays: [30, 7, 0],
      notifiedWindows: [],
      createdAt: new Date(),
    },
    {
      id: "2",
      userId: "test@example.com",
      eventName: "Insurance Certificate",
      propertyLabel: "88 Pine St",
      triggerDate: "2026-11-30",
      originalClause: "Deliver updated certificate of liability insurance.",
      notificationMethod: "custom",
      notificationTarget: "https://hooks.example.com/insurance",
      status: "PAUSED",
      leadTimeDays: [14, 0],
      notifiedWindows: [],
      createdAt: new Date(),
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("displays user name in the header when logged in", () => {
    render(<DashboardShell initialSentinels={[]} user={mockUser} />);
    expect(screen.getByText("Test Bot")).toBeInTheDocument();
  });

  it("displays email if name is not available", () => {
    render(
      <DashboardShell
        initialSentinels={[]}
        user={{ email: "fallback@example.com", name: null, image: null }}
      />
    );
    expect(screen.getByText("fallback@example.com")).toBeInTheDocument();
  });

  it("renders the create sentinel form", () => {
    render(<DashboardShell initialSentinels={[]} user={mockUser} />);
    expect(screen.getByLabelText("Lease Clause to Track")).toBeInTheDocument();
    expect(screen.getByText("Alert Destination")).toBeInTheDocument();
  });

  it("renders sentinel rows and supports search and status filtering", () => {
    render(<DashboardShell initialSentinels={sampleSentinels} user={mockUser} />);

    const table = screen.getByRole("table");
    expect(within(table).getByText("Lease Renewal Notice")).toBeInTheDocument();
    expect(within(table).getByText("Insurance Certificate")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /paused/i }));
    expect(within(table).queryByText("Lease Renewal Notice")).not.toBeInTheDocument();
    expect(within(table).getByText("Insurance Certificate")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^all/i }));
    const searchInput = screen.getByLabelText(/search monitors/i);
    fireEvent.change(searchInput, { target: { value: "450 Market" } });
    expect(within(table).getByText("Lease Renewal Notice")).toBeInTheDocument();
    expect(within(table).queryByText("Insurance Certificate")).not.toBeInTheDocument();
  });

  it("shows empty state when no sentinels exist", () => {
    render(<DashboardShell initialSentinels={[]} user={mockUser} />);
    expect(screen.getByText(/no monitors active/i)).toBeInTheDocument();
  });
});
