import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

vi.mock("@/actions/auth.actions", () => ({
  loginAction: vi.fn(),
  signInWithEmail: vi.fn(),
}));

import { signInWithEmail } from "@/actions/auth.actions";
import LoginPage from "../page";

describe("LoginPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("displays visible error feedback when magic link sign-in fails", async () => {
    vi.mocked(signInWithEmail).mockRejectedValueOnce(new Error("Email provider unavailable"));

    render(<LoginPage />);

    const emailInput = screen.getByLabelText(/email address/i);
    fireEvent.change(emailInput, { target: { value: "tenant@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: /sign in with email/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/email provider unavailable/i);
    });
  });

  it("renders a public live demo link to /demo", () => {
    render(<LoginPage />);

    const demoLink = screen.getByRole("link", { name: /try live demo/i });
    expect(demoLink).toHaveAttribute("href", "/demo");
  });
});
