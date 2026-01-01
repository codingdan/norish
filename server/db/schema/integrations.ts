import { pgTable, uuid, varchar, text, integer, boolean, timestamp, index, unique } from "drizzle-orm/pg-core";
import { users } from "./auth";

export const integrations = pgTable(
  "integrations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: varchar("type", { length: 50 }).notNull(), // 'kitchenowl'
    serverUrl: varchar("server_url", { length: 500 }),
    encryptedToken: text("encrypted_token"),
    defaultHouseholdId: integer("default_household_id"),
    defaultShoppingListId: integer("default_shopping_list_id"),
    enabled: boolean("enabled").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_integrations_user_id").on(table.userId),
    unique("uq_integrations_user_type").on(table.userId, table.type),
  ]
);

export type Integration = typeof integrations.$inferSelect;
export type IntegrationInsert = typeof integrations.$inferInsert;
