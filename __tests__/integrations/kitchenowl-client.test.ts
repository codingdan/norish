import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("KitchenOwl API Client", () => {
  const mockFetch = vi.fn();
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = mockFetch;
    vi.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe("testConnection", () => {
    it("returns success with households when credentials are valid", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([
          { id: 1, name: "Home" },
          { id: 2, name: "Work" },
        ]),
      });

      const { testConnection } = await import("@/lib/integrations/kitchenowl");
      const result = await testConnection("https://kitchen.example.com", "valid-token");

      expect(result.success).toBe(true);
      expect(result.households).toHaveLength(2);
      expect(mockFetch).toHaveBeenCalledWith(
        "https://kitchen.example.com/api/household",
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "Bearer valid-token",
          }),
        })
      );
    });

    it("returns failure when credentials are invalid", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
      });

      const { testConnection } = await import("@/lib/integrations/kitchenowl");
      const result = await testConnection("https://kitchen.example.com", "bad-token");

      expect(result.success).toBe(false);
      expect(result.error).toContain("401");
    });
  });

  describe("getShoppingLists", () => {
    it("returns shopping lists for a household", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([
          { id: 1, name: "Groceries" },
          { id: 2, name: "Hardware Store" },
        ]),
      });

      const { getShoppingLists } = await import("@/lib/integrations/kitchenowl");
      const result = await getShoppingLists("https://kitchen.example.com", "token", 1);

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe("Groceries");
    });
  });

  describe("addItemToShoppingList", () => {
    it("adds item successfully", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 123, name: "1 lb Ground Beef" }),
      });

      const { addItemToShoppingList } = await import("@/lib/integrations/kitchenowl");
      const result = await addItemToShoppingList(
        "https://kitchen.example.com",
        "token",
        1,
        "1 lb Ground Beef"
      );

      expect(result.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        "https://kitchen.example.com/api/shoppinglist/1/add-item-by-name",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ name: "1 lb Ground Beef" }),
        })
      );
    });
  });

  describe("addItemToShoppingList with description", () => {
    it("sends name and description to API", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 123 }),
      });

      const { addItemToShoppingList } = await import("@/lib/integrations/kitchenowl");
      const result = await addItemToShoppingList(
        "https://kitchen.example.com",
        "token",
        1,
        "onion",
        "1"
      );

      expect(result.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        "https://kitchen.example.com/api/shoppinglist/1/add-item-by-name",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ name: "onion", description: "1" }),
        })
      );
    });

    it("omits description when not provided", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 123 }),
      });

      const { addItemToShoppingList } = await import("@/lib/integrations/kitchenowl");
      await addItemToShoppingList(
        "https://kitchen.example.com",
        "token",
        1,
        "onion"
      );

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({ name: "onion" }),
        })
      );
    });
  });

  describe("addItemsToShoppingList", () => {
    it("adds multiple items and returns success count", async () => {
      mockFetch
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) })
        .mockResolvedValueOnce({ ok: false, status: 500 });

      const { addItemsToShoppingList } = await import("@/lib/integrations/kitchenowl");
      const result = await addItemsToShoppingList(
        "https://kitchen.example.com",
        "token",
        1,
        [{ name: "Item 1" }, { name: "Item 2" }, { name: "Item 3" }]
      );

      expect(result.successCount).toBe(2);
      expect(result.failCount).toBe(1);
    });
  });

  describe("error handling", () => {
    it("handles network errors gracefully", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const { testConnection } = await import("@/lib/integrations/kitchenowl");
      const result = await testConnection("https://kitchen.example.com", "token");

      expect(result.success).toBe(false);
      expect(result.error).toContain("Network error");
    });

    it("handles timeout errors", async () => {
      const abortError = new Error("The operation was aborted");
      abortError.name = "AbortError";
      mockFetch.mockRejectedValueOnce(abortError);

      const { testConnection } = await import("@/lib/integrations/kitchenowl");
      const result = await testConnection("https://kitchen.example.com", "token");

      expect(result.success).toBe(false);
      expect(result.error).toContain("timed out");
    });

    it("handles malformed JSON response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.reject(new Error("Invalid JSON")),
      });

      const { testConnection } = await import("@/lib/integrations/kitchenowl");
      const result = await testConnection("https://kitchen.example.com", "token");

      expect(result.success).toBe(false);
    });
  });
});
