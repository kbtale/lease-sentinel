import { describe, it, expect, vi, beforeEach, afterEach, Mock } from "vitest";
import { dispatchAlert } from "../webhook";

/**
 * Unit tests for Webhook Dispatcher.
 * Tests HTTP delivery, timeout handling, and error responses.
 * 
 * Coverage:
 * - Happy Path: Successful webhook delivery
 * - Error Paths: HTTP errors, network failures
 * - Boundary: 5-second timeout handling
 */

// ============================================================================
// Mocks
// ============================================================================

// Store original fetch
const originalFetch = global.fetch;

// ============================================================================
// dispatchAlert Tests
// ============================================================================

describe("dispatchAlert", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset fetch mock before each test
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.resetAllMocks();
    // Restore original fetch
    global.fetch = originalFetch;
  });

  // ---------------------------------------------------------------------------
  // Happy Path Tests
  // ---------------------------------------------------------------------------

  describe("Happy Path", () => {
    it("should return true on successful webhook delivery", async () => {
      // Arrange
      (global.fetch as Mock).mockResolvedValue({
        ok: true,
        status: 200,
      });
      const webhookUrl = "https://hooks.slack.com/services/test";
      const payload = { event: "Lease Renewal", date: "2025-06-15" };

      // Act
      const result = await dispatchAlert(webhookUrl, payload);

      // Assert
      expect(result).toBe(true);
      expect(global.fetch).toHaveBeenCalledOnce();
    });

    it("should send JSON payload with correct headers", async () => {
      // Arrange
      (global.fetch as Mock).mockResolvedValue({
        ok: true,
        status: 200,
      });
      const webhookUrl = "https://hooks.slack.com/services/test";
      const payload = {
        event: "Lease Expiration",
        date: "2025-12-31",
        urgency: "high",
      };

      // Act
      await dispatchAlert(webhookUrl, payload);

      // Assert
      expect(global.fetch).toHaveBeenCalledWith(
        webhookUrl,
        expect.objectContaining({
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        })
      );
    });

    it("should include AbortController signal in fetch options", async () => {
      // Arrange
      (global.fetch as Mock).mockResolvedValue({
        ok: true,
        status: 200,
      });

      // Act
      await dispatchAlert("https://example.com/webhook", { test: true });

      // Assert
      const fetchCall = (global.fetch as Mock).mock.calls[0];
      expect(fetchCall[1]).toHaveProperty("signal");
      expect(fetchCall[1].signal).toBeInstanceOf(AbortSignal);
    });
  });

  // ---------------------------------------------------------------------------
  // HTTP Error Tests
  // ---------------------------------------------------------------------------

  describe("HTTP Errors", () => {
    it("should return false on HTTP 500 error", async () => {
      // Arrange
      (global.fetch as Mock).mockResolvedValue({
        ok: false,
        status: 500,
      });

      // Act
      const result = await dispatchAlert("https://example.com/webhook", {});

      // Assert
      expect(result).toBe(false);
    });

    it("should return false on HTTP 404 error", async () => {
      // Arrange
      (global.fetch as Mock).mockResolvedValue({
        ok: false,
        status: 404,
      });

      // Act
      const result = await dispatchAlert("https://example.com/webhook", {});

      // Assert
      expect(result).toBe(false);
    });

    it("should return false on HTTP 401 unauthorized", async () => {
      // Arrange
      (global.fetch as Mock).mockResolvedValue({
        ok: false,
        status: 401,
      });

      // Act
      const result = await dispatchAlert("https://secure.example.com/webhook", {});

      // Assert
      expect(result).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // Network Error Tests
  // ---------------------------------------------------------------------------

  describe("Network Errors", () => {
    it("should return false on network failure", async () => {
      // Arrange
      (global.fetch as Mock).mockRejectedValue(new Error("Network error"));

      // Act
      const result = await dispatchAlert("https://unreachable.example.com", {});

      // Assert
      expect(result).toBe(false);
    });

    it("should return false on DNS resolution failure", async () => {
      // Arrange
      (global.fetch as Mock).mockRejectedValue(
        new Error("getaddrinfo ENOTFOUND invalid.domain")
      );

      // Act
      const result = await dispatchAlert("https://invalid.domain/webhook", {});

      // Assert
      expect(result).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // Timeout Tests
  // ---------------------------------------------------------------------------

  describe("Timeout Handling", () => {
    it("should return false when request exceeds 5s timeout", async () => {
      // Arrange
      const abortError = new Error("The operation was aborted");
      abortError.name = "AbortError";
      (global.fetch as Mock).mockRejectedValue(abortError);

      // Act
      const result = await dispatchAlert("https://slow.example.com/webhook", {});

      // Assert
      expect(result).toBe(false);
    });

    it("should handle AbortError specifically", async () => {
      // Arrange
      const abortError = new Error("Request aborted");
      abortError.name = "AbortError";
      
      // Spy on console.error to verify specific timeout message
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      (global.fetch as Mock).mockRejectedValue(abortError);

      // Act
      await dispatchAlert("https://timeout.example.com/webhook", {});

      // Assert
      expect(consoleSpy).toHaveBeenCalled();
      const errorMessage = consoleSpy.mock.calls[0][0];
      expect(errorMessage).toContain("Webhook timeout");
      
      consoleSpy.mockRestore();
    });
  });

  // ---------------------------------------------------------------------------
  // Edge Case Tests
  // ---------------------------------------------------------------------------

  describe("Edge Cases", () => {
    it("should handle empty payload", async () => {
      // Arrange
      (global.fetch as Mock).mockResolvedValue({
        ok: true,
        status: 200,
      });

      // Act
      const result = await dispatchAlert("https://example.com/webhook", {});

      // Assert
      expect(result).toBe(true);
      const fetchCall = (global.fetch as Mock).mock.calls[0];
      expect(fetchCall[1].body).toBe("{}");
    });

    it("should handle complex nested payload", async () => {
      // Arrange
      (global.fetch as Mock).mockResolvedValue({
        ok: true,
        status: 200,
      });
      const complexPayload = {
        sentinel: {
          id: "123",
          event: "Lease Renewal",
          metadata: {
            source: "LeaseSentinel",
            version: "1.0",
          },
        },
        recipients: ["admin@example.com", "manager@example.com"],
      };

      // Act
      const result = await dispatchAlert("https://example.com/webhook", complexPayload);

      // Assert
      expect(result).toBe(true);
      const fetchCall = (global.fetch as Mock).mock.calls[0];
      expect(JSON.parse(fetchCall[1].body)).toEqual(complexPayload);
    });
  });
});
