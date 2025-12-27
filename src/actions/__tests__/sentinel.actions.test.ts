import { describe, it, expect, vi, beforeEach, afterEach, Mock } from "vitest";
import { createSentinel, deleteSentinel } from "../sentinel.actions";

/**
 * Unit tests for Sentinel Server Actions.
 * These tests isolate the actions from Firestore and NextAuth using vi.mock().
 * 
 * Coverage:
 * - Security: Authentication and authorization checks
 * - Validation: Input validation via Zod schemas
 * - Error Paths: AI failures, Firestore errors
 * - Happy Paths: Successful create/delete operations
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

// Mock AI extraction
vi.mock("@/lib/ai", () => ({
  extractLeaseData: vi.fn(),
}));

// Mock next/cache
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// Import mocked modules for manipulation
import { auth } from "@/auth";
import { getAdminDb } from "@/lib/firebase";
import { extractLeaseData } from "@/lib/ai";
import { revalidatePath } from "next/cache";

// ============================================================================
// Test Utilities
// ============================================================================

/**
 * Creates a mock FormData object for testing createSentinel.
 */
function createMockFormData(data: Record<string, string>): FormData {
  const formData = new FormData();
  Object.entries(data).forEach(([key, value]) => {
    formData.append(key, value);
  });
  return formData;
}

/**
 * Creates a mock Firestore database with configurable behavior.
 */
function createMockDb(overrides: {
  addResult?: Promise<unknown>;
  getResult?: { exists: boolean; data?: () => Record<string, unknown> };
  deleteResult?: Promise<void>;
} = {}) {
  const mockDelete = vi.fn().mockResolvedValue(overrides.deleteResult ?? undefined);
  const mockGet = vi.fn().mockResolvedValue(overrides.getResult ?? { exists: false });
  const mockAdd = vi.fn().mockResolvedValue(overrides.addResult ?? { id: "new-sentinel-id" });
  
  const mockDoc = vi.fn(() => ({
    get: mockGet,
    delete: mockDelete,
  }));
  
  const mockCollection = vi.fn(() => ({
    add: mockAdd,
    doc: mockDoc,
  }));
  
  return {
    collection: mockCollection,
    _mocks: { mockAdd, mockGet, mockDelete, mockDoc, mockCollection },
  };
}

// ============================================================================
// createSentinel Tests
// ============================================================================

describe("createSentinel", () => {
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
    it("should return error when user is not authenticated", async () => {
      // Arrange
      (auth as Mock).mockResolvedValue(null);
      const formData = createMockFormData({
        clause: "Tenant must provide notice 60 days before lease ends on Dec 31, 2025",
        notificationMethod: "custom",
        notificationTarget: "https://hooks.slack.com/test",
      });

      // Act
      const result = await createSentinel(null, formData);

      // Assert
      expect(result.success).toBe(false);
      expect(result.message).toBe("Unauthorized. Please sign in.");
      expect(auth).toHaveBeenCalledOnce();
    });

    it("should return error when session lacks email", async () => {
      // Arrange
      (auth as Mock).mockResolvedValue({
        user: { name: "Test User" }, // No email property
      });
      const formData = createMockFormData({
        clause: "Tenant must provide notice 60 days before lease ends on Dec 31, 2025",
        notificationMethod: "custom",
        notificationTarget: "https://hooks.slack.com/test",
      });

      // Act
      const result = await createSentinel(null, formData);

      // Assert
      expect(result.success).toBe(false);
      expect(result.message).toBe("Unauthorized. Please sign in.");
    });
  });

  // ---------------------------------------------------------------------------
  // Validation Tests
  // ---------------------------------------------------------------------------

  describe("Input Validation", () => {
    beforeEach(() => {
      // Authenticated user for validation tests
      (auth as Mock).mockResolvedValue({
        user: { email: "test@example.com" },
      });
    });

    it("should return validation error for clause shorter than 10 characters", async () => {
      // Arrange
      const formData = createMockFormData({
        clause: "Short",
        notificationMethod: "custom",
        notificationTarget: "https://hooks.slack.com/test",
      });

      // Act
      const result = await createSentinel(null, formData);

      // Assert
      expect(result.success).toBe(false);
      expect(result.message).toBe("Validation failed");
      expect(result.errors?.clause).toContain("Lease clause must be at least 10 characters");
    });

    it("should return validation error for empty notification target", async () => {
      // Arrange
      const formData = createMockFormData({
        clause: "Tenant must provide notice 60 days before lease ends on Dec 31, 2025",
        notificationMethod: "custom",
        notificationTarget: "",
      });

      // Act
      const result = await createSentinel(null, formData);

      // Assert
      expect(result.success).toBe(false);
      expect(result.message).toBe("Validation failed");
      expect(result.errors?.notificationTarget).toContain("Notification target is required");
    });

    it("should return validation errors for multiple invalid fields", async () => {
      // Arrange
      const formData = createMockFormData({
        clause: "Short",
        notificationMethod: "custom",
        notificationTarget: "",
      });

      // Act
      const result = await createSentinel(null, formData);

      // Assert
      expect(result.success).toBe(false);
      expect(result.errors?.clause).toBeDefined();
      expect(result.errors?.notificationTarget).toBeDefined();
    });
  });

  // ---------------------------------------------------------------------------
  // AI Extraction Tests
  // ---------------------------------------------------------------------------

  describe("AI Extraction", () => {
    beforeEach(() => {
      (auth as Mock).mockResolvedValue({
        user: { email: "test@example.com" },
      });
    });

    it("should return error when AI extraction fails", async () => {
      // Arrange
      (extractLeaseData as Mock).mockResolvedValue(null);
      const formData = createMockFormData({
        clause: "This is some ambiguous text that the AI cannot parse",
        notificationMethod: "email",
        notificationTarget: "test@example.com",
      });

      // Act
      const result = await createSentinel(null, formData);

      // Assert
      expect(result.success).toBe(false);
      expect(result.message).toBe("AI extraction failed. Please try rephrasing the clause.");
      expect(extractLeaseData).toHaveBeenCalledWith(
        "This is some ambiguous text that the AI cannot parse"
      );
    });

    it("should return error when AI returns invalid date format", async () => {
      // Arrange
      (extractLeaseData as Mock).mockResolvedValue({
        eventName: "Lease Renewal",
        triggerDate: "invalid-date", // Invalid format
      });
      const mockDb = createMockDb();
      (getAdminDb as Mock).mockReturnValue(mockDb);
      
      const formData = createMockFormData({
        clause: "Tenant must provide notice 60 days before lease ends",
        notificationMethod: "custom",
        notificationTarget: "https://hooks.slack.com/test",
      });

      // Act
      const result = await createSentinel(null, formData);

      // Assert
      expect(result.success).toBe(false);
      expect(result.message).toBe("Invalid sentinel data generated");
    });
  });

  // ---------------------------------------------------------------------------
  // Firestore Error Tests
  // ---------------------------------------------------------------------------

  describe("Firestore Errors", () => {
    beforeEach(() => {
      (auth as Mock).mockResolvedValue({
        user: { email: "test@example.com" },
      });
      (extractLeaseData as Mock).mockResolvedValue({
        eventName: "Lease Renewal Notice",
        triggerDate: "2025-06-15",
      });
    });

    it("should return error when Firestore save fails", async () => {
      // Arrange
      const mockDb = createMockDb();
      mockDb._mocks.mockAdd.mockRejectedValue(new Error("Firestore connection timeout"));
      (getAdminDb as Mock).mockReturnValue(mockDb);

      const formData = createMockFormData({
        clause: "Tenant must provide notice 60 days before lease ends on Dec 31, 2025",
        notificationMethod: "custom",
        notificationTarget: "https://hooks.slack.com/test",
      });

      // Act
      const result = await createSentinel(null, formData);

      // Assert
      expect(result.success).toBe(false);
      expect(result.message).toBe("Firestore connection timeout");
    });
  });

  // ---------------------------------------------------------------------------
  // Happy Path Tests
  // ---------------------------------------------------------------------------

  describe("Happy Path", () => {
    it("should create sentinel successfully with valid data", async () => {
      // Arrange
      (auth as Mock).mockResolvedValue({
        user: { email: "test@example.com" },
      });
      (extractLeaseData as Mock).mockResolvedValue({
        eventName: "Lease Renewal Notice",
        triggerDate: "2025-06-15",
      });
      const mockDb = createMockDb();
      (getAdminDb as Mock).mockReturnValue(mockDb);

      const formData = createMockFormData({
        clause: "Tenant must provide notice 60 days before lease ends on Dec 31, 2025",
        notificationMethod: "slack",
        notificationTarget: "test@example.com",
      });

      // Act
      const result = await createSentinel(null, formData);

      // Assert
      expect(result.success).toBe(true);
      expect(result.message).toBe("Sentinel created successfully");
      expect(mockDb._mocks.mockAdd).toHaveBeenCalledOnce();
      expect(revalidatePath).toHaveBeenCalledWith("/");
    });

    it("should include userId in saved sentinel data for RLS", async () => {
      // Arrange
      const userEmail = "security-test@example.com";
      (auth as Mock).mockResolvedValue({
        user: { email: userEmail },
      });
      (extractLeaseData as Mock).mockResolvedValue({
        eventName: "Lease Renewal Notice",
        triggerDate: "2025-06-15",
      });
      const mockDb = createMockDb();
      (getAdminDb as Mock).mockReturnValue(mockDb);

      const formData = createMockFormData({
        clause: "Tenant must provide notice 60 days before lease ends on Dec 31, 2025",
        notificationMethod: "email",
        notificationTarget: userEmail,
      });

      // Act
      await createSentinel(null, formData);

      // Assert
      const savedData = mockDb._mocks.mockAdd.mock.calls[0][0];
      expect(savedData.userId).toBe(userEmail);
      expect(savedData.status).toBe("PENDING");
    });
  });
});

// ============================================================================
// deleteSentinel Tests
// ============================================================================

describe("deleteSentinel", () => {
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
    it("should return error when user is not authenticated", async () => {
      // Arrange
      (auth as Mock).mockResolvedValue(null);

      // Act
      const result = await deleteSentinel("sentinel-123");

      // Assert
      expect(result.success).toBe(false);
      expect(result.message).toBe("Unauthorized. Please sign in.");
    });

    it("should deny deletion of another user's sentinel", async () => {
      // Arrange
      (auth as Mock).mockResolvedValue({
        user: { email: "attacker@example.com" },
      });
      const mockDb = createMockDb({
        getResult: {
          exists: true,
          data: () => ({ userId: "victim@example.com" }),
        },
      });
      (getAdminDb as Mock).mockReturnValue(mockDb);

      // Act
      const result = await deleteSentinel("victim-sentinel-id");

      // Assert
      expect(result.success).toBe(false);
      expect(result.message).toBe("Sentinel not found or access denied.");
      expect(mockDb._mocks.mockDelete).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Edge Case Tests
  // ---------------------------------------------------------------------------

  describe("Edge Cases", () => {
    it("should return error when sentinel does not exist", async () => {
      // Arrange
      (auth as Mock).mockResolvedValue({
        user: { email: "test@example.com" },
      });
      const mockDb = createMockDb({
        getResult: { exists: false },
      });
      (getAdminDb as Mock).mockReturnValue(mockDb);

      // Act
      const result = await deleteSentinel("non-existent-id");

      // Assert
      expect(result.success).toBe(false);
      expect(result.message).toBe("Sentinel not found or access denied.");
    });
  });

  // ---------------------------------------------------------------------------
  // Error Path Tests
  // ---------------------------------------------------------------------------

  describe("Error Paths", () => {
    it("should return error when Firestore delete fails", async () => {
      // Arrange
      (auth as Mock).mockResolvedValue({
        user: { email: "test@example.com" },
      });
      const mockDb = createMockDb({
        getResult: {
          exists: true,
          data: () => ({ userId: "test@example.com" }),
        },
      });
      mockDb._mocks.mockDelete.mockRejectedValue(new Error("Firestore write error"));
      (getAdminDb as Mock).mockReturnValue(mockDb);

      // Act
      const result = await deleteSentinel("sentinel-123");

      // Assert
      expect(result.success).toBe(false);
      expect(result.message).toBe("Firestore write error");
    });
  });

  // ---------------------------------------------------------------------------
  // Happy Path Tests
  // ---------------------------------------------------------------------------

  describe("Happy Path", () => {
    it("should delete sentinel successfully when user owns it", async () => {
      // Arrange
      const userEmail = "owner@example.com";
      (auth as Mock).mockResolvedValue({
        user: { email: userEmail },
      });
      const mockDb = createMockDb({
        getResult: {
          exists: true,
          data: () => ({ userId: userEmail }),
        },
      });
      (getAdminDb as Mock).mockReturnValue(mockDb);

      // Act
      const result = await deleteSentinel("my-sentinel-id");

      // Assert
      expect(result.success).toBe(true);
      expect(result.message).toBe("Sentinel deleted successfully");
      expect(mockDb._mocks.mockDelete).toHaveBeenCalledOnce();
      expect(revalidatePath).toHaveBeenCalledWith("/");
    });
  });
});
