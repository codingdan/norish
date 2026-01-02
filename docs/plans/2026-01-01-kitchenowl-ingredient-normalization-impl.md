# KitchenOwl Ingredient Normalization Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add AI-powered ingredient name normalization with caching when sending recipes to KitchenOwl.

**Architecture:** Ingredients like "1 onion (diced)" are normalized to clean names ("onion") with quantity in description ("1"). Uses AI batch normalization with DB caching, falling back to local regex when AI is unavailable. Fallback results aren't cached to allow AI retry.

**Tech Stack:** Drizzle ORM, tRPC, Vitest, OpenAI-compatible providers, PostgreSQL

---

## Task 1: Database Schema for Ingredient Mappings

**Files:**
- Create: `server/db/schema/ingredient-mappings.ts`
- Modify: `server/db/schema/index.ts:24`

**Step 1: Write the schema file**

Create `server/db/schema/ingredient-mappings.ts`:

```typescript
import { pgTable, uuid, text, timestamp, index } from "drizzle-orm/pg-core";

export const ingredientNameMappings = pgTable(
  "ingredient_name_mappings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    rawName: text("raw_name").notNull().unique(),
    normalizedName: text("normalized_name").notNull(),
    source: text("source").notNull(), // "ai" | "fallback" | "manual"
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_ingredient_mappings_raw").on(t.rawName),
  ]
);

export type IngredientNameMapping = typeof ingredientNameMappings.$inferSelect;
export type IngredientNameMappingInsert = typeof ingredientNameMappings.$inferInsert;
```

**Step 2: Export from schema index**

Add to `server/db/schema/index.ts`:

```typescript
export * from "./ingredient-mappings";
```

**Step 3: Run migration generation**

Run: `npm run db:generate`
Expected: New migration file created in `drizzle/` directory

**Step 4: Apply migration**

Run: `npm run db:migrate`
Expected: Migration applied successfully

**Step 5: Commit**

```bash
git add server/db/schema/ingredient-mappings.ts server/db/schema/index.ts drizzle/
git commit -m "$(cat <<'EOF'
feat(db): add ingredient_name_mappings table

Stores cached AI-normalized ingredient names for KitchenOwl integration.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Repository for Ingredient Mappings

**Files:**
- Create: `server/db/repositories/ingredient-mappings.ts`
- Test: `__tests__/repositories/ingredient-mappings.test.ts`

**Step 1: Write the failing test**

Create `__tests__/repositories/ingredient-mappings.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock drizzle
vi.mock("../server/db/drizzle", () => ({
  db: {
    query: {
      ingredientNameMappings: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
      },
    },
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        onConflictDoNothing: vi.fn(() => ({
          returning: vi.fn(),
        })),
      })),
    })),
  },
}));

describe("ingredient-mappings repository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getCachedMappings", () => {
    it("returns cached mappings for given raw names", async () => {
      const { db } = await import("@/server/db/drizzle");
      vi.mocked(db.query.ingredientNameMappings.findMany).mockResolvedValueOnce([
        { id: "1", rawName: "onion (diced)", normalizedName: "onion", source: "ai", createdAt: new Date(), updatedAt: new Date() },
      ]);

      const { getCachedMappings } = await import("@/server/db/repositories/ingredient-mappings");
      const result = await getCachedMappings(["onion (diced)", "garlic"]);

      expect(result.get("onion (diced)")).toBe("onion");
      expect(result.has("garlic")).toBe(false);
    });
  });

  describe("saveMappings", () => {
    it("saves new mappings to the database", async () => {
      const { saveMappings } = await import("@/server/db/repositories/ingredient-mappings");

      await saveMappings([
        { rawName: "onion (diced)", normalizedName: "onion", source: "ai" as const },
      ]);

      const { db } = await import("@/server/db/drizzle");
      expect(db.insert).toHaveBeenCalled();
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- __tests__/repositories/ingredient-mappings.test.ts`
Expected: FAIL - module not found

**Step 3: Write the repository**

Create `server/db/repositories/ingredient-mappings.ts`:

```typescript
import { inArray } from "drizzle-orm";
import { db } from "../drizzle";
import { ingredientNameMappings, type IngredientNameMappingInsert } from "../schema";

export type MappingSource = "ai" | "fallback" | "manual";

export interface MappingInput {
  rawName: string;
  normalizedName: string;
  source: MappingSource;
}

/**
 * Get cached mappings for a list of raw ingredient names.
 * Returns a Map of rawName -> normalizedName for found entries.
 */
export async function getCachedMappings(rawNames: string[]): Promise<Map<string, string>> {
  if (rawNames.length === 0) {
    return new Map();
  }

  const normalizedRawNames = rawNames.map((n) => n.toLowerCase().trim());

  const mappings = await db.query.ingredientNameMappings.findMany({
    where: inArray(ingredientNameMappings.rawName, normalizedRawNames),
  });

  const result = new Map<string, string>();
  for (const mapping of mappings) {
    result.set(mapping.rawName, mapping.normalizedName);
  }

  return result;
}

/**
 * Save new ingredient name mappings to the database.
 * Uses ON CONFLICT DO NOTHING to handle race conditions.
 */
export async function saveMappings(mappings: MappingInput[]): Promise<void> {
  if (mappings.length === 0) {
    return;
  }

  const values: IngredientNameMappingInsert[] = mappings.map((m) => ({
    rawName: m.rawName.toLowerCase().trim(),
    normalizedName: m.normalizedName,
    source: m.source,
  }));

  await db
    .insert(ingredientNameMappings)
    .values(values)
    .onConflictDoNothing();
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- __tests__/repositories/ingredient-mappings.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add server/db/repositories/ingredient-mappings.ts __tests__/repositories/ingredient-mappings.test.ts
git commit -m "$(cat <<'EOF'
feat(repo): add ingredient mappings repository

CRUD operations for cached ingredient name normalization.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Local Fallback Normalizer

**Files:**
- Create: `server/services/ingredient-normalizer.ts`
- Test: `__tests__/services/ingredient-normalizer.test.ts`

**Step 1: Write the failing test for local normalization**

Create `__tests__/services/ingredient-normalizer.test.ts`:

```typescript
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
```

**Step 2: Run test to verify it fails**

Run: `npm test -- __tests__/services/ingredient-normalizer.test.ts`
Expected: FAIL - module not found

**Step 3: Write the local normalizer**

Create `server/services/ingredient-normalizer.ts`:

```typescript
/**
 * Local fallback normalization using regex patterns.
 * Applied when AI is unavailable or disabled.
 */
export function localNormalize(ingredientName: string): string {
  let name = ingredientName.trim();

  // 1. Strip parenthetical suffixes: "(diced)", "(to taste)", "(optional)"
  name = name.replace(/\s*\([^)]*\)\s*$/, "");

  // 2. Strip trailing comma phrases: ", minced", ", for garnish"
  name = name.replace(/,\s*[^,]+$/, "");

  // 3. Strip leading quantities: "2 cloves garlic" -> "garlic"
  // Matches: number (with optional fraction) + optional unit + optional "of "
  name = name.replace(
    /^[\d./]+\s*(oz|lb|lbs|g|kg|ml|l|cups?|tbsp|tsp|cloves?|pieces?|slices?|heads?|stalks?|sprigs?|cans?|bunch|bunches)?\s*(of\s+)?/i,
    ""
  );

  // 4. Trim and normalize whitespace
  name = name.replace(/\s+/g, " ").trim();

  // Return original if normalization emptied the string
  return name || ingredientName.trim();
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- __tests__/services/ingredient-normalizer.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add server/services/ingredient-normalizer.ts __tests__/services/ingredient-normalizer.test.ts
git commit -m "$(cat <<'EOF'
feat(normalizer): add local fallback ingredient normalization

Regex-based normalization for when AI is unavailable.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: AI Batch Normalization

**Files:**
- Create: `server/ai/prompts/ingredient-normalization.txt`
- Modify: `server/services/ingredient-normalizer.ts`
- Test: `__tests__/services/ingredient-normalizer.test.ts`

**Step 1: Create the AI prompt**

Create `server/ai/prompts/ingredient-normalization.txt`:

```text
You are an ingredient name normalizer for a grocery shopping list.

For each ingredient, extract ONLY the base ingredient name that would match a grocery store's product taxonomy. Remove:
- Quantities and measurements (1 cup, 2 cloves, 500g)
- Preparation instructions (diced, chopped, minced, sliced)
- Sizes (large, small, medium)
- Freshness descriptors (fresh, frozen) - UNLESS it changes the product category (e.g., "frozen peas" is different from "peas")

Examples:
- "onion (diced)" → "onion"
- "2 cloves garlic" → "garlic"
- "fresh basil leaves" → "basil"
- "frozen peas" → "frozen peas"
- "1 lb ground beef, 80/20" → "ground beef"
- "chicken breast, boneless skinless" → "chicken breast"

Return a JSON object mapping each input to its normalized name.
```

**Step 2: Write the failing test for AI normalization**

Add to `__tests__/services/ingredient-normalizer.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

// Add mock for AI provider at the top
vi.mock("@/server/ai/providers/factory", () => ({
  getAIProvider: vi.fn(),
}));

vi.mock("@/server/db/repositories/ingredient-mappings", () => ({
  getCachedMappings: vi.fn(),
  saveMappings: vi.fn(),
}));

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
        mappings: { "garlic (minced)": "garlic" },
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
```

**Step 3: Run test to verify it fails**

Run: `npm test -- __tests__/services/ingredient-normalizer.test.ts`
Expected: FAIL - normalizeIngredients not found

**Step 4: Implement AI normalization**

Update `server/services/ingredient-normalizer.ts`:

```typescript
import { readFileSync } from "fs";
import { join } from "path";

import { getAIProvider } from "@/server/ai/providers/factory";
import { getCachedMappings, saveMappings, type MappingInput } from "@/server/db/repositories/ingredient-mappings";
import { createLogger } from "@/server/logger";

const log = createLogger("ingredient-normalizer");

const PROMPT_PATH = join(process.cwd(), "server", "ai", "prompts", "ingredient-normalization.txt");

interface NormalizationResult {
  mappings: Record<string, string>;
}

const normalizationSchema = {
  name: "ingredient_normalization",
  strict: true,
  schema: {
    type: "object",
    properties: {
      mappings: {
        type: "object",
        additionalProperties: { type: "string" },
        description: "Map of original ingredient names to normalized names",
      },
    },
    required: ["mappings"],
    additionalProperties: false,
  },
};

export interface NormalizeOptions {
  useAi: boolean;
  model?: string;
}

/**
 * Local fallback normalization using regex patterns.
 * Applied when AI is unavailable or disabled.
 */
export function localNormalize(ingredientName: string): string {
  let name = ingredientName.trim();

  // 1. Strip parenthetical suffixes: "(diced)", "(to taste)", "(optional)"
  name = name.replace(/\s*\([^)]*\)\s*$/, "");

  // 2. Strip trailing comma phrases: ", minced", ", for garnish"
  name = name.replace(/,\s*[^,]+$/, "");

  // 3. Strip leading quantities: "2 cloves garlic" -> "garlic"
  name = name.replace(
    /^[\d./]+\s*(oz|lb|lbs|g|kg|ml|l|cups?|tbsp|tsp|cloves?|pieces?|slices?|heads?|stalks?|sprigs?|cans?|bunch|bunches)?\s*(of\s+)?/i,
    ""
  );

  // 4. Trim and normalize whitespace
  name = name.replace(/\s+/g, " ").trim();

  return name || ingredientName.trim();
}

/**
 * Normalize ingredient names using AI with caching.
 * Falls back to local normalization if AI fails.
 */
async function aiNormalize(ingredients: string[]): Promise<Map<string, string> | null> {
  try {
    const provider = await getAIProvider();
    const prompt = readFileSync(PROMPT_PATH, "utf-8");

    const userPrompt = `Normalize these ingredients:\n${JSON.stringify(ingredients)}`;

    const result = await provider.generateStructuredOutput<NormalizationResult>(
      userPrompt,
      normalizationSchema,
      prompt
    );

    if (!result?.mappings) {
      log.warn("AI returned empty or invalid response");
      return null;
    }

    return new Map(Object.entries(result.mappings));
  } catch (error) {
    log.error({ err: error }, "AI normalization failed");
    return null;
  }
}

/**
 * Normalize a batch of ingredient names.
 *
 * 1. Check cache for known mappings
 * 2. For uncached: use AI if enabled, otherwise local fallback
 * 3. Cache AI results (but not fallback results)
 *
 * @returns Map of original ingredient name -> normalized name
 */
export async function normalizeIngredients(
  ingredients: string[],
  options: NormalizeOptions
): Promise<Map<string, string>> {
  const result = new Map<string, string>();

  if (ingredients.length === 0) {
    return result;
  }

  // Normalize keys for cache lookup
  const normalizedKeys = ingredients.map((i) => i.toLowerCase().trim());
  const keyToOriginal = new Map<string, string>();
  for (let i = 0; i < ingredients.length; i++) {
    keyToOriginal.set(normalizedKeys[i], ingredients[i]);
  }

  // Step 1: Check cache
  const cached = await getCachedMappings(normalizedKeys);

  // Map cached results back to original keys
  for (const [key, normalized] of cached) {
    const original = keyToOriginal.get(key);
    if (original) {
      result.set(original, normalized);
    }
  }

  // Find uncached ingredients
  const uncached = ingredients.filter(
    (i) => !cached.has(i.toLowerCase().trim())
  );

  if (uncached.length === 0) {
    return result;
  }

  // Step 2: Try AI normalization if enabled
  let aiResults: Map<string, string> | null = null;

  if (options.useAi) {
    aiResults = await aiNormalize(uncached);
  }

  // Step 3: Process results
  const toCache: MappingInput[] = [];

  for (const ingredient of uncached) {
    let normalized: string;

    if (aiResults?.has(ingredient)) {
      normalized = aiResults.get(ingredient)!;
      toCache.push({
        rawName: ingredient,
        normalizedName: normalized,
        source: "ai",
      });
    } else {
      // Use local fallback (don't cache)
      normalized = localNormalize(ingredient);
    }

    result.set(ingredient, normalized);
  }

  // Cache AI results only
  if (toCache.length > 0) {
    await saveMappings(toCache);
  }

  return result;
}
```

**Step 5: Run test to verify it passes**

Run: `npm test -- __tests__/services/ingredient-normalizer.test.ts`
Expected: PASS

**Step 6: Commit**

```bash
git add server/services/ingredient-normalizer.ts server/ai/prompts/ingredient-normalization.txt __tests__/services/ingredient-normalizer.test.ts
git commit -m "$(cat <<'EOF'
feat(normalizer): add AI batch normalization with caching

AI normalizes ingredient names in batches, caches results.
Falls back to local regex when AI unavailable.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Update KitchenOwl API Client

**Files:**
- Modify: `lib/integrations/kitchenowl.ts:111-140`
- Test: `__tests__/integrations/kitchenowl-client.test.ts`

**Step 1: Write the failing test**

Add to `__tests__/integrations/kitchenowl-client.test.ts`:

```typescript
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
```

**Step 2: Run test to verify it fails**

Run: `npm test -- __tests__/integrations/kitchenowl-client.test.ts`
Expected: FAIL - description parameter not supported

**Step 3: Update the API client**

Modify `lib/integrations/kitchenowl.ts`:

```typescript
export async function addItemToShoppingList(
  serverUrl: string,
  apiToken: string,
  shoppingListId: number,
  itemName: string,
  description?: string
): Promise<AddItemResult> {
  const url = `${normalizeUrl(serverUrl)}/api/shoppinglist/${shoppingListId}/add-item-by-name`;

  try {
    const body: { name: string; description?: string } = { name: itemName };
    if (description) {
      body.description = description;
    }

    const response = await fetchWithTimeout(url, {
      method: "POST",
      headers: buildHeaders(apiToken),
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      return {
        success: false,
        error: `Failed to add item: ${response.status}`,
      };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
```

**Step 4: Update addItemsToShoppingList signature**

```typescript
export interface ShoppingListItem {
  name: string;
  description?: string;
}

export async function addItemsToShoppingList(
  serverUrl: string,
  apiToken: string,
  shoppingListId: number,
  items: ShoppingListItem[]
): Promise<AddItemsResult> {
  let successCount = 0;
  let failCount = 0;
  const errors: string[] = [];

  for (const item of items) {
    const result = await addItemToShoppingList(
      serverUrl,
      apiToken,
      shoppingListId,
      item.name,
      item.description
    );
    if (result.success) {
      successCount++;
    } else {
      failCount++;
      if (result.error) {
        errors.push(`${item.name}: ${result.error}`);
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  return { successCount, failCount, errors };
}
```

**Step 5: Run test to verify it passes**

Run: `npm test -- __tests__/integrations/kitchenowl-client.test.ts`
Expected: PASS

**Step 6: Commit**

```bash
git add lib/integrations/kitchenowl.ts __tests__/integrations/kitchenowl-client.test.ts
git commit -m "$(cat <<'EOF'
feat(kitchenowl): add description parameter to shopping list items

Allows sending quantity separately from ingredient name.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Add Normalization Settings to Integrations Schema

**Files:**
- Modify: `server/db/schema/integrations.ts`
- Modify: `server/db/repositories/integrations.ts`

**Step 1: Update the schema**

Add columns to `server/db/schema/integrations.ts`:

```typescript
export const integrations = pgTable(
  "integrations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: varchar("type", { length: 50 }).notNull(),
    serverUrl: varchar("server_url", { length: 500 }),
    encryptedToken: text("encrypted_token"),
    defaultHouseholdId: integer("default_household_id"),
    defaultShoppingListId: integer("default_shopping_list_id"),
    enabled: boolean("enabled").default(true).notNull(),
    // New normalization settings
    enableNormalization: boolean("enable_normalization").default(true).notNull(),
    useAiNormalization: boolean("use_ai_normalization").default(true).notNull(),
    normalizationModel: varchar("normalization_model", { length: 100 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_integrations_user_id").on(table.userId),
    unique("uq_integrations_user_type").on(table.userId, table.type),
  ]
);
```

**Step 2: Generate migration**

Run: `npm run db:generate`
Expected: Migration file created

**Step 3: Apply migration**

Run: `npm run db:migrate`
Expected: Migration applied

**Step 4: Update repository types**

Update `server/db/repositories/integrations.ts`:

```typescript
export interface KitchenOwlConfig {
  serverUrl: string;
  apiToken: string;
  defaultHouseholdId?: number | null;
  defaultShoppingListId?: number | null;
  enabled: boolean;
  enableNormalization: boolean;
  useAiNormalization: boolean;
  normalizationModel?: string | null;
}

export interface KitchenOwlConfigInput {
  serverUrl: string;
  apiToken: string;
  defaultHouseholdId?: number | null;
  defaultShoppingListId?: number | null;
  enableNormalization?: boolean;
  useAiNormalization?: boolean;
  normalizationModel?: string | null;
}
```

**Step 5: Update getKitchenOwlConfig**

```typescript
export async function getKitchenOwlConfig(userId: string): Promise<KitchenOwlConfig | null> {
  const integration = await db.query.integrations.findFirst({
    where: and(
      eq(integrations.userId, userId),
      eq(integrations.type, "kitchenowl")
    ),
  });

  if (!integration || !integration.serverUrl || !integration.encryptedToken) {
    return null;
  }

  return {
    serverUrl: integration.serverUrl,
    apiToken: decrypt(integration.encryptedToken),
    defaultHouseholdId: integration.defaultHouseholdId,
    defaultShoppingListId: integration.defaultShoppingListId,
    enabled: integration.enabled,
    enableNormalization: integration.enableNormalization,
    useAiNormalization: integration.useAiNormalization,
    normalizationModel: integration.normalizationModel,
  };
}
```

**Step 6: Update saveKitchenOwlConfig**

```typescript
export async function saveKitchenOwlConfig(
  userId: string,
  config: KitchenOwlConfigInput
): Promise<Integration> {
  const encryptedToken = encrypt(config.apiToken);

  const existing = await db.query.integrations.findFirst({
    where: and(
      eq(integrations.userId, userId),
      eq(integrations.type, "kitchenowl")
    ),
  });

  if (existing) {
    const [updated] = await db
      .update(integrations)
      .set({
        serverUrl: config.serverUrl,
        encryptedToken,
        defaultHouseholdId: config.defaultHouseholdId ?? null,
        defaultShoppingListId: config.defaultShoppingListId ?? null,
        enableNormalization: config.enableNormalization ?? true,
        useAiNormalization: config.useAiNormalization ?? true,
        normalizationModel: config.normalizationModel ?? null,
        updatedAt: new Date(),
      })
      .where(eq(integrations.id, existing.id))
      .returning();
    return updated;
  }

  const [created] = await db
    .insert(integrations)
    .values({
      userId,
      type: "kitchenowl",
      serverUrl: config.serverUrl,
      encryptedToken,
      defaultHouseholdId: config.defaultHouseholdId ?? null,
      defaultShoppingListId: config.defaultShoppingListId ?? null,
      enableNormalization: config.enableNormalization ?? true,
      useAiNormalization: config.useAiNormalization ?? true,
      normalizationModel: config.normalizationModel ?? null,
      enabled: true,
    })
    .returning();

  return created;
}
```

**Step 7: Commit**

```bash
git add server/db/schema/integrations.ts server/db/repositories/integrations.ts drizzle/
git commit -m "$(cat <<'EOF'
feat(integrations): add normalization settings columns

enableNormalization, useAiNormalization, normalizationModel fields.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Update tRPC Router with Normalization

**Files:**
- Modify: `server/trpc/routers/integrations/index.ts`
- Test: `__tests__/trpc/integrations/integrations.test.ts`

**Step 1: Update the sendToKitchenOwl mutation**

Update `server/trpc/routers/integrations/index.ts`:

```typescript
import { normalizeIngredients } from "@/server/services/ingredient-normalizer";
import type { ShoppingListItem } from "@/lib/integrations/kitchenowl";

// Helper to format quantity description
function formatQuantity(amount: number | null, unit: string | null): string | undefined {
  if (amount === null || amount <= 0) return undefined;
  const parts: string[] = [parseFloat(amount.toFixed(2)).toString()];
  if (unit) parts.push(unit);
  return parts.join(" ");
}

export const integrationsRouter = router({
  // ... existing procedures ...

  // Update getKitchenOwlConfig to return normalization settings
  getKitchenOwlConfig: authedProcedure.query(async ({ ctx }) => {
    const config = await getKitchenOwlConfig(ctx.user.id);
    if (!config) return null;

    return {
      serverUrl: config.serverUrl,
      apiTokenMasked: maskToken(config.apiToken),
      defaultHouseholdId: config.defaultHouseholdId,
      defaultShoppingListId: config.defaultShoppingListId,
      enabled: config.enabled,
      enableNormalization: config.enableNormalization,
      useAiNormalization: config.useAiNormalization,
      normalizationModel: config.normalizationModel,
    };
  }),

  // Update saveKitchenOwlConfig to accept normalization settings
  saveKitchenOwlConfig: authedProcedure
    .input(
      z.object({
        serverUrl: z.string().url("Invalid server URL"),
        apiToken: z.string().min(1, "API token is required"),
        defaultHouseholdId: z.number().optional(),
        defaultShoppingListId: z.number().optional(),
        enableNormalization: z.boolean().optional(),
        useAiNormalization: z.boolean().optional(),
        normalizationModel: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await saveKitchenOwlConfig(ctx.user.id, {
        serverUrl: input.serverUrl,
        apiToken: input.apiToken,
        defaultHouseholdId: input.defaultHouseholdId,
        defaultShoppingListId: input.defaultShoppingListId,
        enableNormalization: input.enableNormalization,
        useAiNormalization: input.useAiNormalization,
        normalizationModel: input.normalizationModel,
      });
      return { success: true };
    }),

  // Updated sendToKitchenOwl with normalization
  sendToKitchenOwl: authedProcedure
    .input(
      z.object({
        recipeId: z.string().uuid(),
        ingredientIds: z.array(z.string().uuid()).optional(),
        servingMultiplier: z.number().positive().default(1),
        shoppingListId: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const config = await getKitchenOwlConfig(ctx.user.id);
      if (!config || !config.enabled) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "KitchenOwl integration not configured or disabled",
        });
      }

      const shoppingListId = input.shoppingListId ?? config.defaultShoppingListId;
      if (!shoppingListId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No shopping list specified and no default configured",
        });
      }

      const recipe = await getRecipeFull(input.recipeId);
      if (!recipe) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Recipe not found",
        });
      }

      // Filter ingredients if specific IDs provided
      let ingredients = recipe.recipeIngredients;
      if (input.ingredientIds && input.ingredientIds.length > 0) {
        const idSet = new Set(input.ingredientIds);
        ingredients = ingredients.filter(
          (ing) => ing.ingredientId !== null && idSet.has(ing.ingredientId)
        );
      }

      // Build items with normalization
      let items: ShoppingListItem[];

      if (config.enableNormalization) {
        // Normalize ingredient names
        const ingredientNames = ingredients.map((ing) => ing.ingredientName);
        const normalizedMap = await normalizeIngredients(ingredientNames, {
          useAi: config.useAiNormalization,
          model: config.normalizationModel ?? undefined,
        });

        items = ingredients.map((ing) => {
          const scaledAmount = ing.amount !== null
            ? ing.amount * input.servingMultiplier
            : null;

          return {
            name: normalizedMap.get(ing.ingredientName) ?? ing.ingredientName,
            description: formatQuantity(scaledAmount, ing.unit),
          };
        });
      } else {
        // No normalization - send full ingredient strings (legacy behavior)
        items = ingredients.map((ing) => {
          const scaledAmount = ing.amount !== null
            ? ing.amount * input.servingMultiplier
            : null;

          return {
            name: formatIngredient(scaledAmount, ing.unit, ing.ingredientName),
          };
        });
      }

      const result = await addItemsToShoppingList(
        config.serverUrl,
        config.apiToken,
        shoppingListId,
        items
      );

      return {
        successCount: result.successCount,
        failCount: result.failCount,
        totalItems: items.length,
      };
    }),
});
```

**Step 2: Run existing tests**

Run: `npm test -- __tests__/trpc/integrations/integrations.test.ts`
Expected: PASS (existing tests should still work)

**Step 3: Commit**

```bash
git add server/trpc/routers/integrations/index.ts
git commit -m "$(cat <<'EOF'
feat(trpc): integrate ingredient normalization in sendToKitchenOwl

Uses normalizer service when enabled in config.
Falls back to legacy full-string format when disabled.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Update Settings UI

**Files:**
- Modify: `app/(app)/settings/integrations/components/kitchenowl-config-card.tsx`

**Step 1: Add state for normalization settings**

Add to the component state:

```typescript
const [enableNormalization, setEnableNormalization] = useState(true);
const [useAiNormalization, setUseAiNormalization] = useState(true);
const [normalizationModel, setNormalizationModel] = useState("");
```

**Step 2: Initialize from config**

Update the useEffect:

```typescript
useEffect(() => {
  if (config) {
    setServerUrl(config.serverUrl || "");
    setSelectedHouseholdId(config.defaultHouseholdId ?? null);
    setEnableNormalization(config.enableNormalization ?? true);
    setUseAiNormalization(config.useAiNormalization ?? true);
    setNormalizationModel(config.normalizationModel ?? "");
  }
}, [config]);
```

**Step 3: Add UI controls**

Add after the shopping list selector in the form:

```tsx
{/* Normalization Settings */}
<div className="space-y-4 pt-4 border-t">
  <h4 className="text-sm font-medium">Ingredient Normalization</h4>

  <div className="flex items-center justify-between">
    <div className="space-y-0.5">
      <Label htmlFor="enable-normalization">Enable normalization</Label>
      <p className="text-xs text-muted-foreground">
        Clean up ingredient names for better matching
      </p>
    </div>
    <Switch
      id="enable-normalization"
      checked={enableNormalization}
      onCheckedChange={setEnableNormalization}
    />
  </div>

  {enableNormalization && (
    <>
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label htmlFor="use-ai-normalization">Use AI normalization</Label>
          <p className="text-xs text-muted-foreground">
            Use AI for smarter name extraction (requires AI enabled)
          </p>
        </div>
        <Switch
          id="use-ai-normalization"
          checked={useAiNormalization}
          onCheckedChange={setUseAiNormalization}
        />
      </div>

      {useAiNormalization && (
        <div className="space-y-2">
          <Label htmlFor="normalization-model">Model override (optional)</Label>
          <Input
            id="normalization-model"
            placeholder="e.g., gpt-4o-mini (leave empty for default)"
            value={normalizationModel}
            onChange={(e) => setNormalizationModel(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Override the AI model used for normalization
          </p>
        </div>
      )}
    </>
  )}
</div>
```

**Step 4: Include in save mutation**

Update the save handler:

```typescript
const handleSave = async () => {
  await saveConfig.mutateAsync({
    serverUrl,
    apiToken: apiToken || undefined,
    defaultHouseholdId: selectedHouseholdId ?? undefined,
    defaultShoppingListId: selectedShoppingListId ?? undefined,
    enableNormalization,
    useAiNormalization,
    normalizationModel: normalizationModel || undefined,
  });
};
```

**Step 5: Run the dev server and test**

Run: `npm run dev`
Expected: Settings UI shows normalization options

**Step 6: Commit**

```bash
git add app/(app)/settings/integrations/components/kitchenowl-config-card.tsx
git commit -m "$(cat <<'EOF'
feat(ui): add normalization settings to KitchenOwl config

Toggle for normalization, AI usage, and model override.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Add Relations for Schema

**Files:**
- Modify: `server/db/schema/relations.ts`

**Step 1: Add relations export**

Add to `server/db/schema/relations.ts` if needed for query builder:

```typescript
import { ingredientNameMappings } from "./ingredient-mappings";

// No relations needed for ingredient_name_mappings table
// It's a standalone global cache
```

**Step 2: Verify queries work**

Run: `npm run dev`
Test: Navigate to settings, save config, send recipe to KitchenOwl

**Step 3: Commit if changes were made**

```bash
git add server/db/schema/relations.ts
git commit -m "$(cat <<'EOF'
chore(schema): add ingredient mappings to relations

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: Full Integration Test

**Step 1: Run all tests**

Run: `npm run test:run`
Expected: All tests pass

**Step 2: Run type check**

Run: `npm run typecheck`
Expected: No type errors

**Step 3: Run build**

Run: `npm run build`
Expected: Build succeeds

**Step 4: Manual E2E test**

1. Start dev server: `npm run dev`
2. Go to Settings > Integrations > KitchenOwl
3. Configure connection
4. Enable normalization with AI
5. Go to a recipe
6. Click "Send to KitchenOwl"
7. Verify items appear with clean names in KitchenOwl

**Step 5: Final commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
test: verify ingredient normalization integration

All tests pass, build succeeds.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Summary

| Task | Description | Key Files |
|------|-------------|-----------|
| 1 | DB Schema | `server/db/schema/ingredient-mappings.ts` |
| 2 | Repository | `server/db/repositories/ingredient-mappings.ts` |
| 3 | Local Fallback | `server/services/ingredient-normalizer.ts` |
| 4 | AI Normalization | `server/services/ingredient-normalizer.ts`, prompt file |
| 5 | API Client Update | `lib/integrations/kitchenowl.ts` |
| 6 | Settings Schema | `server/db/schema/integrations.ts`, repository |
| 7 | tRPC Integration | `server/trpc/routers/integrations/index.ts` |
| 8 | Settings UI | `kitchenowl-config-card.tsx` |
| 9 | Relations | `server/db/schema/relations.ts` |
| 10 | Integration Test | Full test suite |
