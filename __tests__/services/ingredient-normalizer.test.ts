// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

// Add mock for AI provider at the top
vi.mock("@/server/ai/providers/factory", () => ({
  getAIProvider: vi.fn(),
}));

vi.mock("@/server/db/repositories/ingredient-mappings", () => ({
  getCachedMappings: vi.fn(),
  saveMappings: vi.fn(),
}));

vi.mock("@/config/server-config-loader", () => ({
  getUnits: vi.fn().mockResolvedValue({}),
  getPrompts: vi.fn().mockResolvedValue({
    ingredientNormalization: "Mock prompt for ingredient normalization",
  }),
}));

describe("localNormalize", () => {
  it("strips parenthetical suffixes", async () => {
    const { localNormalize } = await import("@/server/services/ingredient-normalizer");

    expect(await localNormalize("onion (diced)")).toBe("onion");
    expect(await localNormalize("salt (to taste)")).toBe("salt");
    expect(await localNormalize("parsley (optional)")).toBe("parsley");
  });

  it("strips trailing comma phrases", async () => {
    const { localNormalize } = await import("@/server/services/ingredient-normalizer");

    expect(await localNormalize("garlic, minced")).toBe("garlic");
    expect(await localNormalize("parsley, for garnish")).toBe("parsley");
  });

  it("strips leading quantities using parse-ingredient", async () => {
    const { localNormalize } = await import("@/server/services/ingredient-normalizer");

    expect(await localNormalize("2 cloves garlic")).toBe("garlic");
    expect(await localNormalize("1 cup flour")).toBe("flour");
    expect(await localNormalize("1/2 lb ground beef")).toBe("ground beef");
    expect(await localNormalize("3 sprigs thyme")).toBe("thyme");
    expect(await localNormalize("2 cans diced tomatoes")).toBe("diced tomatoes");
  });

  it("handles combined patterns", async () => {
    const { localNormalize } = await import("@/server/services/ingredient-normalizer");

    expect(await localNormalize("2 cloves garlic (minced)")).toBe("garlic");
    expect(await localNormalize("1 bunch cilantro, chopped")).toBe("cilantro");
  });

  it("normalizes whitespace", async () => {
    const { localNormalize } = await import("@/server/services/ingredient-normalizer");

    expect(await localNormalize("  onion  ")).toBe("onion");
    expect(await localNormalize("fresh   basil")).toBe("fresh basil");
  });

  it("returns original if nothing to normalize", async () => {
    const { localNormalize } = await import("@/server/services/ingredient-normalizer");

    expect(await localNormalize("chicken breast")).toBe("chicken breast");
    expect(await localNormalize("olive oil")).toBe("olive oil");
  });

  it("returns parsed description even for quantity-only inputs", async () => {
    const { localNormalize } = await import("@/server/services/ingredient-normalizer");

    // parse-ingredient extracts "cup" as the description from "1 cup"
    expect(await localNormalize("1 cup")).toBe("cup");
  });
});

describe("normalizeIngredients", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns cached mappings for known ingredients", async () => {
    const { getCachedMappings } = await import("@/server/db/repositories/ingredient-mappings");
    vi.mocked(getCachedMappings).mockResolvedValueOnce(
      new Map([["onion (diced)", "onion"]])
    );

    const { normalizeIngredients } = await import("@/server/services/ingredient-normalizer");
    const result = await normalizeIngredients(["onion (diced)"], { useAi: false });

    expect(result.get("onion (diced)")).toBe("onion");
  });

  it("uses AI for uncached ingredients when enabled", async () => {
    const { getCachedMappings, saveMappings } = await import("@/server/db/repositories/ingredient-mappings");
    vi.mocked(getCachedMappings).mockResolvedValueOnce(new Map());

    const mockProvider = {
      name: "MockAI",
      generateStructuredOutput: vi.fn().mockResolvedValueOnce({
        mappings: [{ original: "garlic (minced)", normalized: "garlic" }],
      }),
      generateFromImages: vi.fn(),
    };

    const { getAIProvider } = await import("@/server/ai/providers/factory");
    vi.mocked(getAIProvider).mockResolvedValueOnce(mockProvider);

    const { normalizeIngredients } = await import("@/server/services/ingredient-normalizer");
    const result = await normalizeIngredients(["garlic (minced)"], { useAi: true });

    expect(result.get("garlic (minced)")).toBe("garlic");
    expect(saveMappings).toHaveBeenCalledWith([
      { rawName: "garlic (minced)", normalizedName: "garlic", source: "ai" },
    ]);
  });

  it("falls back to local normalization when AI fails", async () => {
    const { getCachedMappings, saveMappings } = await import("@/server/db/repositories/ingredient-mappings");
    vi.mocked(getCachedMappings).mockResolvedValueOnce(new Map());

    const { getAIProvider } = await import("@/server/ai/providers/factory");
    vi.mocked(getAIProvider).mockRejectedValueOnce(new Error("AI unavailable"));

    const { normalizeIngredients } = await import("@/server/services/ingredient-normalizer");
    const result = await normalizeIngredients(["onion (diced)"], { useAi: true });

    expect(result.get("onion (diced)")).toBe("onion");
    // Fallback results should NOT be cached
    expect(saveMappings).not.toHaveBeenCalled();
  });

  it("uses local normalization when AI is disabled", async () => {
    const { getCachedMappings } = await import("@/server/db/repositories/ingredient-mappings");
    vi.mocked(getCachedMappings).mockResolvedValueOnce(new Map());

    const { normalizeIngredients } = await import("@/server/services/ingredient-normalizer");
    const result = await normalizeIngredients(["2 cloves garlic"], { useAi: false });

    expect(result.get("2 cloves garlic")).toBe("garlic");
  });
});
