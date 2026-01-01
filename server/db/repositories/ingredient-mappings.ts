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
