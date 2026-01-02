import { eq, ilike, sql, count, desc, inArray } from "drizzle-orm";
import { db } from "../drizzle";
import {
  ingredientNameMappings,
  type IngredientNameMapping,
  type IngredientNameMappingInsert,
} from "../schema";

export type MappingSource = "ai" | "fallback" | "manual";

export type { IngredientNameMapping };

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

export interface ListMappingsResult {
  data: IngredientNameMapping[];
  total: number;
  page: number;
  limit: number;
}

/**
 * List ingredient name mappings with pagination and optional search.
 */
export async function listMappings(
  page: number,
  limit: number,
  search?: string
): Promise<ListMappingsResult> {
  const offset = (page - 1) * limit;

  const whereClause = search
    ? ilike(ingredientNameMappings.rawName, `%${search}%`)
    : undefined;

  const [mappings, totalResult] = await Promise.all([
    db
      .select()
      .from(ingredientNameMappings)
      .where(whereClause)
      .orderBy(desc(ingredientNameMappings.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: count() })
      .from(ingredientNameMappings)
      .where(whereClause),
  ]);

  return {
    data: mappings,
    total: totalResult[0]?.count ?? 0,
    page,
    limit,
  };
}

/**
 * Add a new ingredient name mapping with source="manual".
 * rawName is lowercased and trimmed.
 */
export async function addMapping(
  rawName: string,
  normalizedName: string
): Promise<IngredientNameMapping> {
  const [created] = await db
    .insert(ingredientNameMappings)
    .values({
      rawName: rawName.toLowerCase().trim(),
      normalizedName,
      source: "manual",
    })
    .returning();

  return created;
}

/**
 * Update an existing ingredient name mapping's normalized name.
 */
export async function updateMapping(
  id: string,
  normalizedName: string
): Promise<IngredientNameMapping | null> {
  const [updated] = await db
    .update(ingredientNameMappings)
    .set({
      normalizedName,
      updatedAt: new Date(),
    })
    .where(eq(ingredientNameMappings.id, id))
    .returning();

  return updated ?? null;
}

/**
 * Delete a single ingredient name mapping by id.
 */
export async function deleteMapping(id: string): Promise<void> {
  await db.delete(ingredientNameMappings).where(eq(ingredientNameMappings.id, id));
}

/**
 * Delete all ingredient name mappings.
 * Returns the number of deleted entries.
 */
export async function clearAllMappings(): Promise<number> {
  const result = await db.delete(ingredientNameMappings);
  return result.rowCount ?? 0;
}
