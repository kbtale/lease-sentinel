import { describe, it, expect, vi, beforeEach, afterEach, Mock } from "vitest";
import { getSentinels } from "../fetch-actions";

/**
 * Unit tests for Fetch Actions.
 * Tests Row-Level Security filtering and Firestore data transformation.
 * 
 * Coverage:
 * - Security: Authentication checks, RLS filtering
 * - Data Transformation: Firestore Timestamp to Date conversion
 * - Error Paths: Firestore failures
 * - Edge Cases: Empty results
 */

// ============================================================================
// Mocks
// ============================================================================

// Mock NextAuth
vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

// Mock Firebase Admin
vi.mock("@/lib/firebase", () => ({
  getAdminDb: vi.fn(),
}));

// Import mocked modules
import { auth } from "@/auth";
import { getAdminDb } from "@/lib/firebase";

// ============================================================================
// Test Utilities
// ============================================================================

/**
 * Creates a mock Firestore query chain for getSentinels.
 */
function createMockQueryDb(options: {
  docs?: Array<{
    id: string;
    data: () => Record<string, unknown>;
  }>;
  error?: Error;
} = {}) {
  const mockGet = options.error
    ? vi.fn().mockRejectedValue(options.error)
    : vi.fn().mockResolvedValue({ docs: options.docs ?? [] });

  const mockOrderBy = vi.fn(() => ({
    get: mockGet,
  }));

  const mockWhere = vi.fn(() => ({
    orderBy: mockOrderBy,
  }));

  const mockCollection = vi.fn(() => ({
    where: mockWhere,
  }));

  return {
    collection: mockCollection,
    _mocks: { mockGet, mockOrderBy, mockWhere, mockCollection },
  };
}

/**
 * Creates a mock Firestore Timestamp object.
 */
function createMockTimestamp(date: Date) {
  return {
    toDate: () => date,
  };
}

// ============================================================================
// getSentinels Tests
// ============================================================================

describe("getSentinels", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  // ---------------------------------------------------------------------------
  // Security Tests
  // ---------------------------------------------------------------------------

  describe("Security", () => {
    it("should return empty array when not authenticated", async () => {
      // Arrange
      (auth as Mock).mockResolvedValue(null);

      // Act
      const result = await getSentinels();

      // Assert
      expect(result).toEqual([]);
      expect(auth).toHaveBeenCalledOnce();
    });

    it("should return empty array when session lacks email", async () => {
      // Arrange
      (auth as Mock).mockResolvedValue({
        user: { name: "Test User" }, // Missing email
      });

      // Act
      const result = await getSentinels();

      // Assert
      expect(result).toEqual([]);
    });

    it("should filter sentinels by user email for RLS", async () => {
      // Arrange
      const userEmail = "rls-test@example.com";
      (auth as Mock).mockResolvedValue({
        user: { email: userEmail },
      });
      const mockDb = createMockQueryDb({
        docs: [
          {
            id: "sentinel-1",
            data: () => ({
              userId: userEmail,
              eventName: "Test Event",
              triggerDate: "2025-06-15",
              originalClause: "Test clause",
              webhookUrl: "https://example.com/webhook",
              status: "PENDING",
              createdAt: new Date("2025-01-01"),
            }),
          },
        ],
      });
      (getAdminDb as Mock).mockReturnValue(mockDb);

      // Act
      await getSentinels();

      // Assert
      expect(mockDb._mocks.mockWhere).toHaveBeenCalledWith("userId", "==", userEmail);
      expect(mockDb._mocks.mockOrderBy).toHaveBeenCalledWith("createdAt", "desc");
    });
  });

  // ---------------------------------------------------------------------------
  // Data Transformation Tests
  // ---------------------------------------------------------------------------

  describe("Data Transformation", () => {
    beforeEach(() => {
      (auth as Mock).mockResolvedValue({
        user: { email: "test@example.com" },
      });
    });

    it("should convert Firestore Timestamp to Date", async () => {
      // Arrange
      const expectedDate = new Date("2025-03-15T10:30:00.000Z");
      const mockDb = createMockQueryDb({
        docs: [
          {
            id: "sentinel-1",
            data: () => ({
              userId: "test@example.com",
              eventName: "Lease Renewal",
              triggerDate: "2025-06-15",
              originalClause: "Test clause",
              webhookUrl: "https://example.com/webhook",
              status: "PENDING",
              createdAt: createMockTimestamp(expectedDate),
            }),
          },
        ],
      });
      (getAdminDb as Mock).mockReturnValue(mockDb);

      // Act
      const result = await getSentinels();

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].createdAt).toEqual(expectedDate);
    });

    it("should handle Date objects directly without conversion", async () => {
      // Arrange
      const expectedDate = new Date("2025-03-15T10:30:00.000Z");
      const mockDb = createMockQueryDb({
        docs: [
          {
            id: "sentinel-1",
            data: () => ({
              userId: "test@example.com",
              eventName: "Lease Renewal",
              triggerDate: "2025-06-15",
              originalClause: "Test clause",
              webhookUrl: "https://example.com/webhook",
              status: "FIRED",
              createdAt: expectedDate, // Already a Date
            }),
          },
        ],
      });
      (getAdminDb as Mock).mockReturnValue(mockDb);

      // Act
      const result = await getSentinels();

      // Assert
      expect(result[0].createdAt).toEqual(expectedDate);
    });

    it("should use current date when createdAt is missing or invalid", async () => {
      // Arrange
      const beforeTest = new Date();
      const mockDb = createMockQueryDb({
        docs: [
          {
            id: "sentinel-1",
            data: () => ({
              userId: "test@example.com",
              eventName: "Lease Renewal",
              triggerDate: "2025-06-15",
              originalClause: "Test clause",
              webhookUrl: "https://example.com/webhook",
              status: "PENDING",
              // createdAt is missing
            }),
          },
        ],
      });
      (getAdminDb as Mock).mockReturnValue(mockDb);

      // Act
      const result = await getSentinels();

      // Assert
      expect(result[0].createdAt.getTime()).toBeGreaterThanOrEqual(beforeTest.getTime());
    });

    it("should include document ID in returned sentinel", async () => {
      // Arrange
      const expectedId = "unique-doc-id-123";
      const mockDb = createMockQueryDb({
        docs: [
          {
            id: expectedId,
            data: () => ({
              userId: "test@example.com",
              eventName: "Test Event",
              triggerDate: "2025-06-15",
              originalClause: "Test",
              webhookUrl: "https://example.com/webhook",
              status: "PENDING",
              createdAt: new Date(),
            }),
          },
        ],
      });
      (getAdminDb as Mock).mockReturnValue(mockDb);

      // Act
      const result = await getSentinels();

      // Assert
      expect(result[0].id).toBe(expectedId);
    });
  });

  // ---------------------------------------------------------------------------
  // Edge Case Tests
  // ---------------------------------------------------------------------------

  describe("Edge Cases", () => {
    beforeEach(() => {
      (auth as Mock).mockResolvedValue({
        user: { email: "test@example.com" },
      });
    });

    it("should return empty array when no sentinels exist", async () => {
      // Arrange
      const mockDb = createMockQueryDb({ docs: [] });
      (getAdminDb as Mock).mockReturnValue(mockDb);

      // Act
      const result = await getSentinels();

      // Assert
      expect(result).toEqual([]);
    });

    it("should return multiple sentinels in correct order", async () => {
      // Arrange
      const mockDb = createMockQueryDb({
        docs: [
          {
            id: "newer",
            data: () => ({
              userId: "test@example.com",
              eventName: "Newer Event",
              triggerDate: "2025-07-01",
              originalClause: "Newer clause",
              webhookUrl: "https://example.com/webhook",
              status: "PENDING",
              createdAt: new Date("2025-06-01"),
            }),
          },
          {
            id: "older",
            data: () => ({
              userId: "test@example.com",
              eventName: "Older Event",
              triggerDate: "2025-05-01",
              originalClause: "Older clause",
              webhookUrl: "https://example.com/webhook",
              status: "FIRED",
              createdAt: new Date("2025-01-01"),
            }),
          },
        ],
      });
      (getAdminDb as Mock).mockReturnValue(mockDb);

      // Act
      const result = await getSentinels();

      // Assert
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe("newer");
      expect(result[1].id).toBe("older");
    });
  });

  // ---------------------------------------------------------------------------
  // Error Path Tests
  // ---------------------------------------------------------------------------

  describe("Error Paths", () => {
    beforeEach(() => {
      (auth as Mock).mockResolvedValue({
        user: { email: "test@example.com" },
      });
    });

    it("should return empty array on Firestore error", async () => {
      // Arrange
      const mockDb = createMockQueryDb({
        error: new Error("Firestore connection failed"),
      });
      (getAdminDb as Mock).mockReturnValue(mockDb);

      // Act
      const result = await getSentinels();

      // Assert
      expect(result).toEqual([]);
    });
  });
});
