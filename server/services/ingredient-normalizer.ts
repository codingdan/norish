import { loadPrompt } from "@/server/ai/prompts/loader";
import { getAIProvider } from "@/server/ai/providers/factory";
import { getCachedMappings, saveMappings, type MappingInput } from "@/server/db/repositories/ingredient-mappings";
import { createLogger } from "@/server/logger";
import { parseIngredientWithDefaults } from "@/lib/helpers";
import { getUnits } from "@/config/server-config-loader";

const log = createLogger("ingredient-normalizer");

interface NormalizationMapping {
  original: string;
  normalized: string;
}

interface NormalizationResult {
  mappings: NormalizationMapping[];
}

const normalizationSchema = {
  name: "ingredient_normalization",
  strict: true,
  schema: {
    type: "object",
    properties: {
      mappings: {
        type: "array",
        items: {
          type: "object",
          properties: {
            original: {
              type: "string",
              description: "The original ingredient name from the input",
            },
            normalized: {
              type: "string",
              description: "The normalized/cleaned ingredient name",
            },
          },
          required: ["original", "normalized"],
          additionalProperties: false,
        },
        description: "Array of original to normalized ingredient mappings",
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

/**
 * Normalize ingredient names using AI with caching.
 * Falls back to local normalization if AI fails.
 */
async function aiNormalize(ingredients: string[]): Promise<Map<string, string> | null> {
  try {
    const provider = await getAIProvider();
    const prompt = await loadPrompt("ingredient-normalization");

    const userPrompt = `Normalize these ingredients:\n${JSON.stringify(ingredients)}`;

    const result = await provider.generateStructuredOutput<NormalizationResult>(
      userPrompt,
      normalizationSchema,
      prompt
    );

    if (!result?.mappings || !Array.isArray(result.mappings)) {
      log.warn("AI returned empty or invalid response");
      return null;
    }

    // Convert array of {original, normalized} to Map
    const mappingMap = new Map<string, string>();
    for (const mapping of result.mappings) {
      if (mapping.original && mapping.normalized) {
        mappingMap.set(mapping.original, mapping.normalized);
      }
    }
    return mappingMap;
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

  log.info({ count: ingredients.length, useAi: options.useAi }, "Starting ingredient normalization");

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
  log.debug({ cachedCount: cached.size }, "Cache lookup complete");

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
    log.info("All ingredients found in cache");
    return result;
  }

  log.debug({ uncachedCount: uncached.length, uncached }, "Ingredients not in cache");

  // Step 2: Try AI normalization if enabled
  let aiResults: Map<string, string> | null = null;

  if (options.useAi) {
    log.info("Attempting AI normalization");
    aiResults = await aiNormalize(uncached);
    if (aiResults) {
      log.info({ aiResultCount: aiResults.size }, "AI normalization successful");
    }
  } else {
    log.info("AI normalization disabled, using local fallback");
  }

  // Step 3: Process results
  const toCache: MappingInput[] = [];

  for (const ingredient of uncached) {
    let normalized: string;
    let source: string;

    if (aiResults?.has(ingredient)) {
      normalized = aiResults.get(ingredient)!;
      source = "ai";
      toCache.push({
        rawName: ingredient,
        normalizedName: normalized,
        source: "ai",
      });
    } else {
      // Use local fallback (don't cache)
      normalized = await localNormalize(ingredient);
      source = "local";
    }

    log.debug({ original: ingredient, normalized, source }, "Normalized ingredient");
    result.set(ingredient, normalized);
  }

  // Cache AI results only
  if (toCache.length > 0) {
    await saveMappings(toCache);
    log.info({ cachedCount: toCache.length }, "Saved AI results to cache");
  }

  return result;
}
