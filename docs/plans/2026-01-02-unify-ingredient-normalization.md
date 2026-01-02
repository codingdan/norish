# Unify Ingredient Normalization Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the regex-based `localNormalize()` fallback with the same `parseIngredientWithDefaults()` function used by the internal shopping list, making external normalization consistent with internal behavior.

**Architecture:** The local fallback will call `parseIngredientWithDefaults()` to extract the `description` field (ingredient name without quantity/unit), then apply minimal cleanup. AI normalization remains as an optional enhancement.

**Tech Stack:** TypeScript, parse-ingredient library, Vitest

---

## Task 1: Update localNormalize to use parseIngredientWithDefaults

**Files:**
- Modify: `server/services/ingredient-normalizer.ts:1-76`

**Step 1: Add import for parseIngredientWithDefaults and getUnits**

Add to imports at top of file:

```typescript
import { parseIngredientWithDefaults } from "@/lib/helpers";
import { getUnits } from "@/config/server-config-loader";
```

**Step 2: Replace localNormalize with parse-ingredient based implementation**

Replace the entire `localNormalize` function (lines 53-76) with:

```typescript
/**
 * Local fallback normalization using parse-ingredient library.
 * Uses the same parsing logic as the internal shopping list.
 * Applied when AI is unavailable or disabled.
 */
export async function localNormalize(ingredientName: string): Promise<string> {
  const units = await getUnits();
  const parsed = parseIngredientWithDefaults(ingredientName, units);

  // Get the description (ingredient name without qty/unit)
  const description = parsed[0]?.description?.trim();

  if (!description) {
    return ingredientName.trim();
  }

  // Apply minimal cleanup on the description:
  // 1. Strip parenthetical suffixes: "(diced)", "(optional)"
  let name = description.replace(/\s*\([^)]*\)\s*$/, "");

  // 2. Strip trailing comma phrases: ", minced", ", for garnish"
  name = name.replace(/,\s*[^,]+$/, "");

  // 3. Normalize whitespace
  name = name.replace(/\s+/g, " ").trim();

  return name || ingredientName.trim();
}
```

**Step 3: Run TypeScript compiler to check for errors**

Run: `npx tsc --noEmit`
Expected: Type errors because `localNormalize` is now async

---

## Task 2: Update normalizeIngredients to handle async localNormalize

**Files:**
- Modify: `server/services/ingredient-normalizer.ts:179-201`

**Step 1: Update the fallback call to await localNormalize**

In the `normalizeIngredients` function, find this block (around line 194-198):

```typescript
} else {
  // Use local fallback (don't cache)
  normalized = localNormalize(ingredient);
  source = "local";
}
```

Replace with:

```typescript
} else {
  // Use local fallback (don't cache)
  normalized = await localNormalize(ingredient);
  source = "local";
}
```

**Step 2: Run TypeScript compiler to verify fix**

Run: `npx tsc --noEmit`
Expected: PASS (no type errors)

---

## Task 3: Update tests for async localNormalize

**Files:**
- Modify: `__tests__/services/ingredient-normalizer.test.ts:13-65`

**Step 1: Update all localNormalize tests to be async**

Replace the entire `describe("localNormalize")` block with:

```typescript
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

  it("returns original if normalization would empty the string", async () => {
    const { localNormalize } = await import("@/server/services/ingredient-normalizer");

    expect(await localNormalize("1 cup")).toBe("1 cup");
  });
});
```

**Step 2: Add mock for server config loader**

Add this mock near the top of the file (after the existing mocks):

```typescript
vi.mock("@/config/server-config-loader", () => ({
  getUnits: vi.fn().mockResolvedValue({}),
}));
```

**Step 3: Run the tests**

Run: `npx vitest run __tests__/services/ingredient-normalizer.test.ts`
Expected: All tests PASS

---

## Task 4: Run full test suite and verify

**Files:**
- None (verification only)

**Step 1: Run full test suite**

Run: `npm test`
Expected: All tests pass

**Step 2: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors

---

## Task 5: Commit changes

**Step 1: Stage and commit**

```bash
git add server/services/ingredient-normalizer.ts __tests__/services/ingredient-normalizer.test.ts
git commit -m "refactor: unify ingredient normalization with internal shopping list

- Replace regex-based localNormalize with parseIngredientWithDefaults
- Local fallback now uses same parsing as internal grocery list
- AI normalization remains as optional enhancement
- Make localNormalize async to support units config loading"
```

---

## Summary of Changes

| Before | After |
|--------|-------|
| Regex strips qty/unit patterns | `parseIngredientWithDefaults()` extracts description |
| Limited unit recognition (~15 units) | Full unit recognition from config + library |
| Sync function | Async function (loads units config) |
| Different behavior from internal list | Same behavior as internal list |

**What's preserved:**
- Parenthetical stripping: `"(diced)"`, `"(optional)"`
- Trailing comma phrase stripping: `", minced"`, `", for garnish"`
- AI normalization toggle (unchanged)
- Caching behavior (unchanged - only AI results cached)
