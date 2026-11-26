import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

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

const mockGenerateContent = vi.fn();
const mockGetGenerativeModel = vi.fn(() => ({
  generateContent: mockGenerateContent,
}));

vi.mock("@google/generative-ai", () => {
  return {
    GoogleGenerativeAI: class MockGoogleGenerativeAI {
      getGenerativeModel(config: unknown) {
        return mockGetGenerativeModel(config);
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

    it("uses gemini-2.5-flash by default and respects GEMINI_MODEL env var", async () => {
      mockGenerateContent.mockResolvedValue({
        response: {
          text: () => JSON.stringify({ eventName: "Notice", triggerDate: "2025-08-01" }),
        },
      });

      const { extractLeaseData } = await import("@/lib/ai");
      await extractLeaseData("Notice due August 1, 2025");
      expect(mockGetGenerativeModel).toHaveBeenCalledWith(
        expect.objectContaining({ model: "gemini-2.5-flash" })
      );

      mockGetGenerativeModel.mockClear();
      vi.stubEnv("GEMINI_MODEL", "gemini-2.5-pro");
      await extractLeaseData("Notice due August 1, 2025");
      expect(mockGetGenerativeModel).toHaveBeenCalledWith(
        expect.objectContaining({ model: "gemini-2.5-pro" })
      );
    });

    it("rejects malformed or impossible calendar dates via Zod schema", async () => {
      mockGenerateContent.mockResolvedValueOnce({
        response: {
          text: () => JSON.stringify({ eventName: "Bad Date", triggerDate: "2025-02-30" }),
        },
      });

      const { extractLeaseData } = await import("@/lib/ai");
      expect(await extractLeaseData("Some lease")).toBeNull();

      mockGenerateContent.mockResolvedValueOnce({
        response: {
          text: () => JSON.stringify({ eventName: "Bad Format", triggerDate: "June 15, 2025" }),
        },
      });
      expect(await extractLeaseData("Some lease")).toBeNull();
    });
  });
});

describe("extractMultipleLeaseDeadlines", () => {
  beforeEach(() => {
    vi.stubEnv("GOOGLE_API_KEY", "test-api-key");
    mockGenerateContent.mockClear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("extracts and validates multiple structured deadlines from full lease text", async () => {
    mockGenerateContent.mockResolvedValueOnce({
      response: {
        text: () =>
          JSON.stringify({
            deadlines: [
              {
                eventName: "Lease Renewal Notice",
                triggerDate: "2026-09-01",
                category: "renewal",
                sourceQuote: "Tenant must notify landlord 90 days prior to Dec 1, 2026.",
                suggestedLeadDays: [30, 7, 0],
              },
              {
                eventName: "Annual Rent Escalation",
                triggerDate: "2027-01-01",
                category: "escalation",
                sourceQuote: "Base rent increases 3% on January 1, 2027.",
                suggestedLeadDays: [14, 0],
              },
            ],
          }),
      },
    });

    const { extractMultipleLeaseDeadlines } = await import("@/lib/ai");
    const deadlines = await extractMultipleLeaseDeadlines("Full commercial lease text...");

    expect(deadlines).toHaveLength(2);
    expect(deadlines[0].category).toBe("renewal");
    expect(deadlines[1].triggerDate).toBe("2027-01-01");
  });

  it("filters out entries with invalid calendar dates", async () => {
    mockGenerateContent.mockResolvedValueOnce({
      response: {
        text: () =>
          JSON.stringify({
            deadlines: [
              {
                eventName: "Valid Deadline",
                triggerDate: "2026-08-15",
                category: "termination",
                sourceQuote: "Termination option expires Aug 15, 2026.",
                suggestedLeadDays: [30, 7, 0],
              },
              {
                eventName: "Impossible Date",
                triggerDate: "2026-02-30",
                category: "other",
                sourceQuote: "Invalid date",
                suggestedLeadDays: [7, 0],
              },
            ],
          }),
      },
    });

    const { extractMultipleLeaseDeadlines } = await import("@/lib/ai");
    const deadlines = await extractMultipleLeaseDeadlines("Lease text...");

    expect(deadlines).toHaveLength(1);
    expect(deadlines[0].eventName).toBe("Valid Deadline");
  });
});
