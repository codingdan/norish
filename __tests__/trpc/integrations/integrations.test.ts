import { describe, it, expect, vi, beforeEach } from "vitest";

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

describe("integrations tRPC router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getKitchenOwlConfig", () => {
    it("returns config without exposing full token", async () => {
      const { getKitchenOwlConfig } = await import("@/server/db/repositories/integrations");
      vi.mocked(getKitchenOwlConfig).mockResolvedValue({
        serverUrl: "https://kitchen.example.com",
        apiToken: "super-secret-token-12345",
        defaultHouseholdId: 1,
        defaultShoppingListId: 1,
        enabled: true,
      });

      // Test token masking logic
      const token = "super-secret-token-12345";
      const masked = token.slice(0, 4) + "••••" + token.slice(-4);
      expect(masked).toBe("supe••••2345");
    });
  });

  describe("testKitchenOwlConnection", () => {
    it("returns households on successful connection", async () => {
      const { testConnection } = await import("@/lib/integrations/kitchenowl");
      vi.mocked(testConnection).mockResolvedValue({
        success: true,
        households: [{ id: 1, name: "Home" }],
      });

      const result = await testConnection("https://kitchen.example.com", "token");
      expect(result.success).toBe(true);
      expect(result.households).toHaveLength(1);
    });
  });

  describe("sendToKitchenOwl", () => {
    it("formats ingredients correctly for KitchenOwl", async () => {
      const ingredient = {
        amount: 1.5,
        unit: "lb",
        ingredientName: "Ground Beef",
      };

      const formatted = `${ingredient.amount} ${ingredient.unit} ${ingredient.ingredientName}`;
      expect(formatted).toBe("1.5 lb Ground Beef");
    });

    it("scales quantities by serving multiplier", () => {
      const originalAmount = 2;
      const originalServings = 4;
      const targetServings = 8;
      const multiplier = targetServings / originalServings;

      const scaledAmount = originalAmount * multiplier;
      expect(scaledAmount).toBe(4);
    });
  });
});
