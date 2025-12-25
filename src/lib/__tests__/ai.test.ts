import { describe, it, expect, vi, beforeEach, afterEach, Mock } from "vitest";

/**
 * Tests for AI extraction logic.
 * Mocks the Gemini API to test parsing logic without external calls.
 * 
 * Coverage:
 * - Happy Path: Valid AI responses with correct JSON structure
 * - Error Paths: Invalid JSON, missing fields, API errors
 * - Edge Cases: Empty input, very long input, malformed responses
 */

// ============================================================================
// Mocks
// ============================================================================

// Create a shared mock function for generateContent
const mockGenerateContent = vi.fn();

// Mock the Google Generative AI module
vi.mock("@google/generative-ai", () => {
  return {
    GoogleGenerativeAI: class MockGoogleGenerativeAI {
      constructor() {
        // Constructor does nothing
      }
      getGenerativeModel() {
        return {
          generateContent: mockGenerateContent,
        };
      }
    },
  };
});

// ============================================================================
// extractLeaseData Tests
// ============================================================================

describe("extractLeaseData", () => {
  beforeEach(async () => {
    // Set required env var
    vi.stubEnv("GOOGLE_API_KEY", "test-api-key");
    // Clear mock calls between tests
    mockGenerateContent.mockClear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  // ---------------------------------------------------------------------------
  // Happy Path Tests
  // ---------------------------------------------------------------------------

  describe("Happy Path", () => {
    it("should return valid extraction for well-formed lease clause", async () => {
      // Arrange
      mockGenerateContent.mockResolvedValue({
        response: {
          text: () => JSON.stringify({
            eventName: "Lease Renewal Notice",
            triggerDate: "2025-06-15",
          }),
        },
      });

      // Act
      const { extractLeaseData } = await import("@/lib/ai");
      const result = await extractLeaseData("Notice must be given 6 months before Dec 31, 2025");

      // Assert
      expect(result).toEqual({
        eventName: "Lease Renewal Notice",
        triggerDate: "2025-06-15",
      });
    });

    it("should handle lease clause with specific deadline date", async () => {
      // Arrange
      mockGenerateContent.mockResolvedValue({
        response: {
          text: () => JSON.stringify({
            eventName: "Rent Escalation",
            triggerDate: "2025-01-01",
          }),
        },
      });

      // Act
      const { extractLeaseData } = await import("@/lib/ai");
      const result = await extractLeaseData("Annual rent increases by 3% on January 1st each year");

      // Assert
      expect(result).not.toBeNull();
      expect(result?.eventName).toBe("Rent Escalation");
      expect(result?.triggerDate).toBe("2025-01-01");
    });
  });

  // ---------------------------------------------------------------------------
  // Invalid Response Tests
  // ---------------------------------------------------------------------------

  describe("Invalid AI Responses", () => {
    it("should return null for non-JSON response text", async () => {
      // Arrange
      mockGenerateContent.mockResolvedValue({
        response: {
          text: () => "This is not valid JSON",
        },
      });

      // Act
      const { extractLeaseData } = await import("@/lib/ai");
      const result = await extractLeaseData("asdfghjkl random gibberish");

      // Assert
      expect(result).toBeNull();
    });

    it("should return null when response is missing eventName field", async () => {
      // Arrange
      mockGenerateContent.mockResolvedValue({
        response: {
          text: () => JSON.stringify({
            // eventName is missing
            triggerDate: "2025-06-15",
          }),
        },
      });

      // Act
      const { extractLeaseData } = await import("@/lib/ai");
      const result = await extractLeaseData("Some lease text");

      // Assert
      expect(result).toBeNull();
    });

    it("should return null when response is missing triggerDate field", async () => {
      // Arrange
      mockGenerateContent.mockResolvedValue({
        response: {
          text: () => JSON.stringify({
            eventName: "Test Event",
            // triggerDate is missing
          }),
        },
      });

      // Act
      const { extractLeaseData } = await import("@/lib/ai");
      const result = await extractLeaseData("Some lease text");

      // Assert
      expect(result).toBeNull();
    });

    it("should return null when eventName is not a string", async () => {
      // Arrange
      mockGenerateContent.mockResolvedValue({
        response: {
          text: () => JSON.stringify({
            eventName: 12345, // Should be string
            triggerDate: "2025-06-15",
          }),
        },
      });

      // Act
      const { extractLeaseData } = await import("@/lib/ai");
      const result = await extractLeaseData("Some lease text");

      // Assert
      expect(result).toBeNull();
    });

    it("should return null when triggerDate is not a string", async () => {
      // Arrange
      mockGenerateContent.mockResolvedValue({
        response: {
          text: () => JSON.stringify({
            eventName: "Test Event",
            triggerDate: 20250615, // Should be string
          }),
        },
      });

      // Act
      const { extractLeaseData } = await import("@/lib/ai");
      const result = await extractLeaseData("Some lease text");

      // Assert
      expect(result).toBeNull();
    });

    it("should return null when response is null", async () => {
      // Arrange
      mockGenerateContent.mockResolvedValue({
        response: {
          text: () => "null",
        },
      });

      // Act
      const { extractLeaseData } = await import("@/lib/ai");
      const result = await extractLeaseData("Some lease text");

      // Assert
      expect(result).toBeNull();
    });

    it("should return null when response is empty object", async () => {
      // Arrange
      mockGenerateContent.mockResolvedValue({
        response: {
          text: () => "{}",
        },
      });

      // Act
      const { extractLeaseData } = await import("@/lib/ai");
      const result = await extractLeaseData("Some lease text");

      // Assert
      expect(result).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // API Error Tests
  // ---------------------------------------------------------------------------

  describe("API Errors", () => {
    it("should return null when API call throws error", async () => {
      // Arrange
      mockGenerateContent.mockRejectedValue(new Error("API Error"));

      // Act
      const { extractLeaseData } = await import("@/lib/ai");
      const result = await extractLeaseData("Some lease text");

      // Assert
      expect(result).toBeNull();
    });

    it("should return null on network timeout", async () => {
      // Arrange
      mockGenerateContent.mockRejectedValue(new Error("ECONNREFUSED"));

      // Act
      const { extractLeaseData } = await import("@/lib/ai");
      const result = await extractLeaseData("Network test");

      // Assert
      expect(result).toBeNull();
    });

    it("should return null on rate limit error", async () => {
      // Arrange
      mockGenerateContent.mockRejectedValue(new Error("429 Too Many Requests"));

      // Act
      const { extractLeaseData } = await import("@/lib/ai");
      const result = await extractLeaseData("Rate limit test");

      // Assert
      expect(result).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // Edge Case Tests
  // ---------------------------------------------------------------------------

  describe("Edge Cases", () => {
    it("should handle empty input text gracefully", async () => {
      // Arrange
      mockGenerateContent.mockResolvedValue({
        response: {
          text: () => JSON.stringify({
            eventName: "Default Event",
            triggerDate: "2025-07-25", // 30 days from "today"
          }),
        },
      });

      // Act
      const { extractLeaseData } = await import("@/lib/ai");
      const result = await extractLeaseData("");

      // Assert
      // Function should still work with empty input (AI might return default)
      expect(result).not.toBeNull();
    });

    it("should handle very long input text without error", async () => {
      // Arrange
      const longText = "Tenant must provide notice. ".repeat(500); // ~14k chars
      mockGenerateContent.mockResolvedValue({
        response: {
          text: () => JSON.stringify({
            eventName: "Long Document Notice",
            triggerDate: "2025-06-15",
          }),
        },
      });

      // Act
      const { extractLeaseData } = await import("@/lib/ai");
      const result = await extractLeaseData(longText);

      // Assert
      expect(result).toEqual({
        eventName: "Long Document Notice",
        triggerDate: "2025-06-15",
      });
    });

    it("should handle special characters in lease text", async () => {
      // Arrange
      mockGenerateContent.mockResolvedValue({
        response: {
          text: () => JSON.stringify({
            eventName: "Tenant's Option",
            triggerDate: "2025-06-15",
          }),
        },
      });

      // Act
      const { extractLeaseData } = await import("@/lib/ai");
      const result = await extractLeaseData("Tenant's option to renew (see §5.2) by 06/15/2025");

      // Assert
      expect(result).not.toBeNull();
      expect(result?.eventName).toBe("Tenant's Option");
    });

    it("should handle unicode characters in response", async () => {
      // Arrange
      mockGenerateContent.mockResolvedValue({
        response: {
          text: () => JSON.stringify({
            eventName: "Renovación de Contrato",
            triggerDate: "2025-06-15",
          }),
        },
      });

      // Act
      const { extractLeaseData } = await import("@/lib/ai");
      const result = await extractLeaseData("El contrato vence el 31 de diciembre");

      // Assert
      expect(result).not.toBeNull();
      expect(result?.eventName).toBe("Renovación de Contrato");
    });
  });
});
