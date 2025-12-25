import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * Tests for date utility functions.
 * These ensure consistent date handling across timezones and
 * verify the lease renewal window alert logic.
 * 
 * Coverage:
 * - getTodayISO: UTC date formatting
 * - isDateMatch: Exact date comparison
 * - isWithinNoticeWindow: Lease renewal window boundary logic
 */

// ============================================================================
// getTodayISO Tests
// ============================================================================

describe("date-utils", () => {
  describe("getTodayISO", () => {
    beforeEach(() => {
      // Mock Date to return a fixed date
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2025-06-15T12:00:00.000Z"));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("should return date in YYYY-MM-DD format", async () => {
      // Arrange
      // (Date is mocked in beforeEach)

      // Act
      const { getTodayISO } = await import("@/lib/date-utils");
      const result = getTodayISO();

      // Assert
      expect(result).toBe("2025-06-15");
    });

    it("should use UTC to avoid timezone issues", async () => {
      // Arrange
      vi.setSystemTime(new Date("2025-12-31T23:59:59.000Z"));

      // Act
      const { getTodayISO } = await import("@/lib/date-utils");
      const result = getTodayISO();

      // Assert
      // Even at 23:59 UTC, should still be Dec 31, not Jan 1
      expect(result).toBe("2025-12-31");
    });

    it("should handle leap year dates correctly", async () => {
      // Arrange
      vi.setSystemTime(new Date("2024-02-29T12:00:00.000Z"));

      // Act
      const { getTodayISO } = await import("@/lib/date-utils");
      const result = getTodayISO();

      // Assert
      expect(result).toBe("2024-02-29");
    });

    it("should handle midnight UTC correctly", async () => {
      // Arrange
      vi.setSystemTime(new Date("2025-01-01T00:00:00.000Z"));

      // Act
      const { getTodayISO } = await import("@/lib/date-utils");
      const result = getTodayISO();

      // Assert
      expect(result).toBe("2025-01-01");
    });
  });

  // ============================================================================
  // isDateMatch Tests
  // ============================================================================

  describe("isDateMatch", () => {
    it("should return true for matching dates", async () => {
      // Arrange
      const date1 = "2025-06-15";
      const date2 = "2025-06-15";

      // Act
      const { isDateMatch } = await import("@/lib/date-utils");
      const result = isDateMatch(date1, date2);

      // Assert
      expect(result).toBe(true);
    });

    it("should return false for non-matching dates", async () => {
      // Arrange
      const date1 = "2025-06-15";
      const date2 = "2025-06-16";

      // Act
      const { isDateMatch } = await import("@/lib/date-utils");
      const result = isDateMatch(date1, date2);

      // Assert
      expect(result).toBe(false);
    });

    it("should handle month-end boundaries", async () => {
      // Arrange
      const lastDayOfJan = "2025-01-31";
      const firstDayOfFeb = "2025-02-01";

      // Act
      const { isDateMatch } = await import("@/lib/date-utils");
      const result = isDateMatch(lastDayOfJan, firstDayOfFeb);

      // Assert
      expect(result).toBe(false);
    });

    it("should handle year boundaries", async () => {
      // Arrange
      const lastDayOfYear = "2025-12-31";
      const firstDayOfNextYear = "2026-01-01";

      // Act
      const { isDateMatch } = await import("@/lib/date-utils");
      const result = isDateMatch(lastDayOfYear, firstDayOfNextYear);

      // Assert
      expect(result).toBe(false);
    });
  });

  // ============================================================================
  // isWithinNoticeWindow Tests
  // ============================================================================

  describe("isWithinNoticeWindow", () => {
    // ---------------------------------------------------------------------------
    // Boundary Tests
    // ---------------------------------------------------------------------------

    describe("Boundary Conditions", () => {
      it("should return false when trigger date is in the past", async () => {
        // Arrange
        const triggerDate = "2025-06-01";
        const todayDate = "2025-06-15";
        const windowDays = 30;

        // Act
        const { isWithinNoticeWindow } = await import("@/lib/date-utils");
        const result = isWithinNoticeWindow(triggerDate, todayDate, windowDays);

        // Assert
        expect(result).toBe(false);
      });

      it("should return true when trigger date is exactly today (0 days)", async () => {
        // Arrange
        const triggerDate = "2025-06-15";
        const todayDate = "2025-06-15";
        const windowDays = 30;

        // Act
        const { isWithinNoticeWindow } = await import("@/lib/date-utils");
        const result = isWithinNoticeWindow(triggerDate, todayDate, windowDays);

        // Assert
        expect(result).toBe(true);
      });

      it("should return true when trigger date equals window boundary", async () => {
        // Arrange
        const todayDate = "2025-06-01";
        const triggerDate = "2025-07-01"; // Exactly 30 days from today
        const windowDays = 30;

        // Act
        const { isWithinNoticeWindow } = await import("@/lib/date-utils");
        const result = isWithinNoticeWindow(triggerDate, todayDate, windowDays);

        // Assert
        expect(result).toBe(true);
      });

      it("should return false when trigger date exceeds window by one day", async () => {
        // Arrange
        const todayDate = "2025-06-01";
        const triggerDate = "2025-07-02"; // 31 days from today
        const windowDays = 30;

        // Act
        const { isWithinNoticeWindow } = await import("@/lib/date-utils");
        const result = isWithinNoticeWindow(triggerDate, todayDate, windowDays);

        // Assert
        expect(result).toBe(false);
      });

      it("should return true when trigger is one day before window boundary", async () => {
        // Arrange
        const todayDate = "2025-06-01";
        const triggerDate = "2025-06-30"; // 29 days from today
        const windowDays = 30;

        // Act
        const { isWithinNoticeWindow } = await import("@/lib/date-utils");
        const result = isWithinNoticeWindow(triggerDate, todayDate, windowDays);

        // Assert
        expect(result).toBe(true);
      });
    });

    // ---------------------------------------------------------------------------
    // Happy Path Tests
    // ---------------------------------------------------------------------------

    describe("Happy Path", () => {
      it("should return true for trigger date within window", async () => {
        // Arrange
        const todayDate = "2025-06-01";
        const triggerDate = "2025-06-15"; // 14 days from today
        const windowDays = 30;

        // Act
        const { isWithinNoticeWindow } = await import("@/lib/date-utils");
        const result = isWithinNoticeWindow(triggerDate, todayDate, windowDays);

        // Assert
        expect(result).toBe(true);
      });

      it("should handle small window sizes correctly", async () => {
        // Arrange
        const todayDate = "2025-06-15";
        const triggerDate = "2025-06-17"; // 2 days ahead
        const windowDays = 7; // One-week window

        // Act
        const { isWithinNoticeWindow } = await import("@/lib/date-utils");
        const result = isWithinNoticeWindow(triggerDate, todayDate, windowDays);

        // Assert
        expect(result).toBe(true);
      });
    });

    // ---------------------------------------------------------------------------
    // Edge Case Tests
    // ---------------------------------------------------------------------------

    describe("Edge Cases", () => {
      it("should handle zero-day window (only today matches)", async () => {
        // Arrange
        const todayDate = "2025-06-15";
        const triggerToday = "2025-06-15";
        const triggerTomorrow = "2025-06-16";
        const windowDays = 0;

        // Act
        const { isWithinNoticeWindow } = await import("@/lib/date-utils");
        const resultToday = isWithinNoticeWindow(triggerToday, todayDate, windowDays);
        const resultTomorrow = isWithinNoticeWindow(triggerTomorrow, todayDate, windowDays);

        // Assert
        expect(resultToday).toBe(true);
        expect(resultTomorrow).toBe(false);
      });

      it("should handle year-crossing windows", async () => {
        // Arrange
        const todayDate = "2025-12-15";
        const triggerDate = "2026-01-10"; // 26 days from today, crosses year
        const windowDays = 30;

        // Act
        const { isWithinNoticeWindow } = await import("@/lib/date-utils");
        const result = isWithinNoticeWindow(triggerDate, todayDate, windowDays);

        // Assert
        expect(result).toBe(true);
      });

      it("should handle leap year crossing", async () => {
        // Arrange
        const todayDate = "2024-02-15";
        const triggerDate = "2024-03-15"; // 29 days (leap year Feb has 29 days)
        const windowDays = 30;

        // Act
        const { isWithinNoticeWindow } = await import("@/lib/date-utils");
        const result = isWithinNoticeWindow(triggerDate, todayDate, windowDays);

        // Assert
        expect(result).toBe(true);
      });

      it("should handle very large window sizes", async () => {
        // Arrange
        const todayDate = "2025-01-01";
        const triggerDate = "2025-12-31"; // 364 days ahead
        const windowDays = 365;

        // Act
        const { isWithinNoticeWindow } = await import("@/lib/date-utils");
        const result = isWithinNoticeWindow(triggerDate, todayDate, windowDays);

        // Assert
        expect(result).toBe(true);
      });
    });
  });
});
