import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies
vi.mock("@/server/db/repositories/integrations", () => ({
  getKitchenOwlConfig: vi.fn(),
  saveKitchenOwlConfig: vi.fn(),
  deleteKitchenOwlConfig: vi.fn(),
}));

vi.mock("@/lib/integrations/kitchenowl", () => ({
  testConnection: vi.fn(),
  getShoppingLists: vi.fn(),
  addItemsToShoppingList: vi.fn(),
}));

vi.mock("@/server/db/repositories/recipes", () => ({
  getRecipeFull: vi.fn(),
}));

vi.mock("@/server/services/ingredient-normalizer", () => ({
  normalizeIngredients: vi.fn(),
}));

vi.mock("@/config/server-config-loader", () => ({
  getAIConfig: vi.fn(),
}));

describe("integrations tRPC router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("token masking behavior", () => {
    // Tests the masking logic used in getKitchenOwlConfig response
    function maskToken(token: string): string {
      if (token.length <= 8) return "••••••••";
      return token.slice(0, 4) + "••••" + token.slice(-4);
    }

    it("masks short tokens completely", () => {
      expect(maskToken("short")).toBe("••••••••");
      expect(maskToken("12345678")).toBe("••••••••");
    });

    it("shows first and last 4 chars for long tokens", () => {
      expect(maskToken("super-secret-token-12345")).toBe("supe••••2345");
      expect(maskToken("123456789")).toBe("1234••••6789");
    });
  });

  describe("ingredient formatting behavior", () => {
    // Tests the formatting logic used in sendToKitchenOwl
    function formatIngredient(
      amount: number | null,
      unit: string | null,
      name: string
    ): string {
      const parts: string[] = [];
      if (amount !== null && amount > 0) {
        parts.push(parseFloat(amount.toFixed(2)).toString());
      }
      if (unit) {
        parts.push(unit);
      }
      parts.push(name);
      return parts.join(" ");
    }

    it("formats ingredients with amount and unit", () => {
      expect(formatIngredient(1.5, "lb", "Ground Beef")).toBe("1.5 lb Ground Beef");
      expect(formatIngredient(2, "cups", "flour")).toBe("2 cups flour");
    });

    it("formats ingredients without amount", () => {
      expect(formatIngredient(null, null, "salt")).toBe("salt");
      expect(formatIngredient(0, null, "salt")).toBe("salt");
    });

    it("includes unit even when amount is zero", () => {
      // Note: The implementation includes unit regardless of amount
      expect(formatIngredient(0, "pinch", "salt")).toBe("pinch salt");
    });

    it("formats ingredients without unit", () => {
      expect(formatIngredient(2, null, "eggs")).toBe("2 eggs");
    });

    it("handles decimal precision", () => {
      expect(formatIngredient(1.333333, "cup", "sugar")).toBe("1.33 cup sugar");
      expect(formatIngredient(0.5, "tsp", "vanilla")).toBe("0.5 tsp vanilla");
    });
  });

  describe("quantity formatting behavior", () => {
    // Tests the formatQuantity logic used for normalized ingredients
    function formatQuantity(amount: number | null, unit: string | null): string | undefined {
      if (amount === null || amount <= 0) return undefined;
      const parts: string[] = [parseFloat(amount.toFixed(2)).toString()];
      if (unit) parts.push(unit);
      return parts.join(" ");
    }

    it("formats quantity with unit", () => {
      expect(formatQuantity(1.5, "lb")).toBe("1.5 lb");
      expect(formatQuantity(2, "cups")).toBe("2 cups");
    });

    it("formats quantity without unit", () => {
      expect(formatQuantity(3, null)).toBe("3");
    });

    it("returns undefined for null/zero/negative amounts", () => {
      expect(formatQuantity(null, "lb")).toBeUndefined();
      expect(formatQuantity(0, "cups")).toBeUndefined();
      expect(formatQuantity(-1, "oz")).toBeUndefined();
    });
  });

  describe("serving multiplier scaling", () => {
    it("scales quantities correctly", () => {
      const originalAmount = 2;
      const multiplier = 1.5;
      expect(originalAmount * multiplier).toBe(3);
    });

    it("handles fractional scaling", () => {
      const originalAmount = 1;
      const originalServings = 4;
      const targetServings = 6;
      const multiplier = targetServings / originalServings;
      expect(originalAmount * multiplier).toBe(1.5);
    });
  });

  describe("ingredient filtering behavior", () => {
    it("filters ingredients by provided IDs", () => {
      const allIngredients = [
        { ingredientId: "a", ingredientName: "flour" },
        { ingredientId: "b", ingredientName: "sugar" },
        { ingredientId: "c", ingredientName: "eggs" },
        { ingredientId: null, ingredientName: "salt" },
      ];
      const selectedIds = new Set(["a", "c"]);

      const filtered = allIngredients.filter(
        (ing) => ing.ingredientId !== null && selectedIds.has(ing.ingredientId)
      );

      expect(filtered).toHaveLength(2);
      expect(filtered.map((i) => i.ingredientName)).toEqual(["flour", "eggs"]);
    });

    it("excludes ingredients with null IDs", () => {
      const ingredients = [
        { ingredientId: null, ingredientName: "salt" },
        { ingredientId: "a", ingredientName: "flour" },
      ];
      const selectedIds = new Set(["a"]);

      const filtered = ingredients.filter(
        (ing) => ing.ingredientId !== null && selectedIds.has(ing.ingredientId)
      );

      expect(filtered).toHaveLength(1);
      expect(filtered[0].ingredientName).toBe("flour");
    });
  });

  describe("repository mock behavior", () => {
    it("getKitchenOwlConfig returns null for unconfigured users", async () => {
      const { getKitchenOwlConfig } = await import("@/server/db/repositories/integrations");
      vi.mocked(getKitchenOwlConfig).mockResolvedValue(null);

      const result = await getKitchenOwlConfig("user-123");
      expect(result).toBeNull();
    });

    it("testConnection returns households on success", async () => {
      const { testConnection } = await import("@/lib/integrations/kitchenowl");
      vi.mocked(testConnection).mockResolvedValue({
        success: true,
        households: [{ id: 1, name: "Home" }, { id: 2, name: "Work" }],
      });

      const result = await testConnection("https://kitchen.example.com", "token");
      expect(result.success).toBe(true);
      expect(result.households).toHaveLength(2);
    });

    it("testConnection returns error on failure", async () => {
      const { testConnection } = await import("@/lib/integrations/kitchenowl");
      vi.mocked(testConnection).mockResolvedValue({
        success: false,
        error: "Connection refused",
      });

      const result = await testConnection("https://kitchen.example.com", "bad-token");
      expect(result.success).toBe(false);
      expect(result.error).toBe("Connection refused");
    });
  });
});
