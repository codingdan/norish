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
