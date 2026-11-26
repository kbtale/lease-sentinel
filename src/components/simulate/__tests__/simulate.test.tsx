import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { SimulateClient } from "../SimulateClient";

vi.mock("@/actions/sentinel.actions", () => ({
  createSentinel: vi.fn(),
}));

vi.mock("@/actions/admin.actions", () => ({
  triggerCronManual: vi.fn(),
}));

describe("SimulateClient", () => {
  it("hides Admin System Override section for non-admin users", () => {
    render(<SimulateClient isAdmin={false} userEmail="user@example.com" />);

    expect(screen.getByLabelText(/channel/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/notification target/i)).toBeInTheDocument();
    expect(screen.queryByText(/trigger cron job now/i)).not.toBeInTheDocument();
  });

  it("shows Admin System Override section for allowlisted admins", () => {
    render(<SimulateClient isAdmin={true} userEmail="admin@example.com" />);

    expect(screen.getByRole("button", { name: /trigger cron job now/i })).toBeInTheDocument();
  });
});
