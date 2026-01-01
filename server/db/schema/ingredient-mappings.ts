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
