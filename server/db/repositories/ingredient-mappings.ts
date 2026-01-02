import { inArray, like, count, eq, desc } from "drizzle-orm";
import { db } from "../drizzle";
import { ingredientNameMappings, type IngredientNameMappingInsert, type IngredientNameMapping } from "../schema";

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

/**
 * List ingredient mappings with pagination and optional search.
 */
export async function listMappings(
  page: number = 1,
  limit: number = 20,
  search?: string
): Promise<{ entries: IngredientNameMapping[]; total: number }> {
  const offset = (page - 1) * limit;

  const whereClause = search
    ? like(ingredientNameMappings.rawName, `%${search.toLowerCase()}%`)
    : undefined;

  const [entries, totalResult] = await Promise.all([
    db.query.ingredientNameMappings.findMany({
      where: whereClause,
      limit,
      offset,
      orderBy: desc(ingredientNameMappings.createdAt),
    }),
    db
      .select({ count: count() })
      .from(ingredientNameMappings)
      .where(whereClause),
  ]);

  return {
    entries,
    total: totalResult[0]?.count ?? 0,
  };
}

/**
 * Add a new manual ingredient mapping.
 */
export async function addMapping(
  rawName: string,
  normalizedName: string
): Promise<IngredientNameMapping> {
  const [result] = await db
    .insert(ingredientNameMappings)
    .values({
      rawName: rawName.toLowerCase().trim(),
      normalizedName: normalizedName.trim(),
      source: "manual",
    })
    .returning();

  return result;
}

/**
 * Update the normalized name for an existing mapping.
 */
export async function updateMapping(
  id: string,
  normalizedName: string
): Promise<IngredientNameMapping | null> {
  const [result] = await db
    .update(ingredientNameMappings)
    .set({
      normalizedName: normalizedName.trim(),
      updatedAt: new Date(),
    })
    .where(eq(ingredientNameMappings.id, id))
    .returning();

  return result ?? null;
}

/**
 * Delete a single mapping by ID.
 */
export async function deleteMapping(id: string): Promise<boolean> {
  const result = await db
    .delete(ingredientNameMappings)
    .where(eq(ingredientNameMappings.id, id))
    .returning({ id: ingredientNameMappings.id });

  return result.length > 0;
}

/**
 * Clear all ingredient mappings (reset cache).
 */
export async function clearAllMappings(): Promise<number> {
  const result = await db
    .delete(ingredientNameMappings)
    .returning({ id: ingredientNameMappings.id });

  return result.length;
}
