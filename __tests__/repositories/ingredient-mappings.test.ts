import { describe, it, expect, vi, beforeEach } from "vitest";

// Create mock functions using vi.hoisted so they're available during mock hoisting
const { mockFindMany, mockInsert, mockValues, mockOnConflictDoNothing, mockDb } = vi.hoisted(() => {
  const mockFindMany = vi.fn();
  const mockInsert = vi.fn();
  const mockValues = vi.fn();
  const mockOnConflictDoNothing = vi.fn();

  const mockDb = {
    query: {
      ingredientNameMappings: {
        findMany: mockFindMany,
      },
    },
    insert: mockInsert,
  };

  // Setup chainable mocks
  mockInsert.mockReturnValue({ values: mockValues });
  mockValues.mockReturnValue({ onConflictDoNothing: mockOnConflictDoNothing });

  return { mockFindMany, mockInsert, mockValues, mockOnConflictDoNothing, mockDb };
});

// Mock the drizzle module
vi.mock("@/server/db/drizzle", () => ({
  db: mockDb,
}));

describe("ingredient-mappings repository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset chainable mocks
    mockInsert.mockReturnValue({ values: mockValues });
    mockValues.mockReturnValue({ onConflictDoNothing: mockOnConflictDoNothing });
  });

  describe("getCachedMappings", () => {
    it("returns cached mappings for given raw names", async () => {
      mockFindMany.mockResolvedValueOnce([
        { id: "1", rawName: "onion (diced)", normalizedName: "onion", source: "ai", createdAt: new Date(), updatedAt: new Date() },
      ]);

      const { getCachedMappings } = await import("@/server/db/repositories/ingredient-mappings");
      const result = await getCachedMappings(["onion (diced)", "garlic"]);

      expect(result.get("onion (diced)")).toBe("onion");
      expect(result.has("garlic")).toBe(false);
    });

    it("returns empty map for empty input", async () => {
      const { getCachedMappings } = await import("@/server/db/repositories/ingredient-mappings");
      const result = await getCachedMappings([]);

      expect(result.size).toBe(0);
      expect(result).toBeInstanceOf(Map);
    });

    it("returns mappings keyed by original input case", async () => {
      mockFindMany.mockResolvedValueOnce([
        { id: "1", rawName: "onion (diced)", normalizedName: "onion", source: "ai", createdAt: new Date(), updatedAt: new Date() },
      ]);

      const { getCachedMappings } = await import("@/server/db/repositories/ingredient-mappings");
      // Query with mixed case - should still find the lowercase entry
      const result = await getCachedMappings(["Onion (Diced)", "GARLIC"]);

      // Should be keyed by original input, not db value
      expect(result.get("Onion (Diced)")).toBe("onion");
      expect(result.has("onion (diced)")).toBe(false); // DB key should not be exposed
    });
  });

  describe("saveMappings", () => {
    it("saves new mappings to the database", async () => {
      const { saveMappings } = await import("@/server/db/repositories/ingredient-mappings");

      await saveMappings([
        { rawName: "onion (diced)", normalizedName: "onion", source: "ai" as const },
      ]);

      expect(mockInsert).toHaveBeenCalled();
      expect(mockValues).toHaveBeenCalled();
      expect(mockOnConflictDoNothing).toHaveBeenCalled();
    });

    it("normalizes raw names to lowercase and trimmed", async () => {
      const { saveMappings } = await import("@/server/db/repositories/ingredient-mappings");

      await saveMappings([
        { rawName: "  ONION  ", normalizedName: "onion", source: "ai" as const },
      ]);

      expect(mockValues).toHaveBeenCalledWith([
        expect.objectContaining({ rawName: "onion" }),
      ]);
    });
  });
});
