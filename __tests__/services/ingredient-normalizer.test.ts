import { describe, it, expect } from "vitest";

describe("localNormalize", () => {
  it("strips parenthetical suffixes", async () => {
    const { localNormalize } = await import("@/server/services/ingredient-normalizer");

    expect(localNormalize("onion (diced)")).toBe("onion");
    expect(localNormalize("salt (to taste)")).toBe("salt");
    expect(localNormalize("parsley (optional)")).toBe("parsley");
  });

  it("strips trailing comma phrases", async () => {
    const { localNormalize } = await import("@/server/services/ingredient-normalizer");

    expect(localNormalize("garlic, minced")).toBe("garlic");
    expect(localNormalize("parsley, for garnish")).toBe("parsley");
  });

  it("strips leading quantities", async () => {
    const { localNormalize } = await import("@/server/services/ingredient-normalizer");

    expect(localNormalize("2 cloves garlic")).toBe("garlic");
    expect(localNormalize("1 cup flour")).toBe("flour");
    expect(localNormalize("1/2 lb ground beef")).toBe("ground beef");
    expect(localNormalize("3 sprigs thyme")).toBe("thyme");
    expect(localNormalize("2 cans diced tomatoes")).toBe("diced tomatoes");
  });

  it("handles combined patterns", async () => {
    const { localNormalize } = await import("@/server/services/ingredient-normalizer");

    expect(localNormalize("2 cloves garlic (minced)")).toBe("garlic");
    expect(localNormalize("1 bunch cilantro, chopped")).toBe("cilantro");
  });

  it("normalizes whitespace", async () => {
    const { localNormalize } = await import("@/server/services/ingredient-normalizer");

    expect(localNormalize("  onion  ")).toBe("onion");
    expect(localNormalize("fresh   basil")).toBe("fresh basil");
  });

  it("returns original if nothing to normalize", async () => {
    const { localNormalize } = await import("@/server/services/ingredient-normalizer");

    expect(localNormalize("chicken breast")).toBe("chicken breast");
    expect(localNormalize("olive oil")).toBe("olive oil");
  });

  it("returns original if normalization would empty the string", async () => {
    const { localNormalize } = await import("@/server/services/ingredient-normalizer");

    expect(localNormalize("1 cup")).toBe("1 cup");
  });
});
