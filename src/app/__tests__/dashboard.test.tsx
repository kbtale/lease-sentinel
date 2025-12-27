import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";

// Mock server actions
vi.mock("@/actions/sentinel.actions", () => ({
  createSentinel: vi.fn(),
  deleteSentinel: vi.fn(),
}));

vi.mock("@/actions/auth.actions", () => ({
  logoutAction: vi.fn(),
}));

// Mock sonner toast
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

  it("displays user name in the header when logged in", () => {
    render(
      <DashboardShell initialSentinels={[]} user={mockUser} />
    );

    // User name should be visible
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
    render(
      <DashboardShell initialSentinels={[]} user={mockUser} />
    );

    expect(screen.getByLabelText("Lease Clause to Track")).toBeInTheDocument();
    expect(screen.getByText("Alert Destination")).toBeInTheDocument();
  });

  it("renders sentinel rows when provided", () => {
    const mockSentinels = [
      {
        id: "1",
        userId: "test-user",
        eventName: "Lease Renewal",
        triggerDate: "2025-06-15",
        originalClause: "Test clause",
        notificationMethod: "email" as const,
        notificationTarget: "test@example.com",
        status: "PENDING" as const,
        createdAt: new Date(),
      },
    ];

    render(
      <DashboardShell initialSentinels={mockSentinels} user={mockUser} />
    );

    expect(screen.getByText("Lease Renewal")).toBeInTheDocument();
  });

  it("shows empty state when no sentinels exist", () => {
    render(
      <DashboardShell initialSentinels={[]} user={mockUser} />
    );

    expect(screen.getByText(/no monitors active/i)).toBeInTheDocument();
  });
});

