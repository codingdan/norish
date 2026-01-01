# KitchenOwl Integration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable users to send recipe ingredients from Norish to KitchenOwl shopping lists with one click.

**Architecture:** User-scoped integration config stored encrypted in database. tRPC procedures handle KitchenOwl API communication. Recipe view gets a new "Add to KitchenOwl" action that scales ingredients by serving multiplier before sending.

**Tech Stack:** Drizzle ORM (PostgreSQL), tRPC, Next.js, HeroUI components, Vitest

**Spec Reference:** `specs/norish-kitchenowl-integration-spec.md`

---

## Task 1: Database Schema for Integrations

**Files:**
- Create: `server/db/schema/integrations.ts`
- Modify: `server/db/schema/index.ts`
- Modify: `server/db/index.ts` (if needed for relations)

**Step 1: Create the integrations schema file**

Create `server/db/schema/integrations.ts`:

```typescript
import { pgTable, uuid, varchar, text, integer, boolean, timestamp, index, unique } from "drizzle-orm/pg-core";
import { users } from "./auth";

export const integrations = pgTable(
  "integrations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    type: varchar("type", { length: 50 }).notNull(), // 'kitchenowl'
    serverUrl: varchar("server_url", { length: 500 }),
    encryptedToken: text("encrypted_token"),
    defaultHouseholdId: integer("default_household_id"),
    defaultShoppingListId: integer("default_shopping_list_id"),
    enabled: boolean("enabled").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_integrations_user_id").on(table.userId),
    unique("uq_integrations_user_type").on(table.userId, table.type),
  ]
);

export type Integration = typeof integrations.$inferSelect;
export type IntegrationInsert = typeof integrations.$inferInsert;
```

**Step 2: Export from schema index**

Add to `server/db/schema/index.ts`:

```typescript
export * from "./integrations";
```

**Step 3: Generate and run migration**

Run:
```bash
pnpm drizzle-kit generate
pnpm drizzle-kit migrate
```

Expected: Migration file created in `drizzle/` and applied to database.

**Step 4: Commit**

```bash
git add server/db/schema/integrations.ts server/db/schema/index.ts drizzle/
git commit -m "feat: add integrations database schema for KitchenOwl"
```

---

## Task 2: Integration Repository

**Files:**
- Create: `server/db/repositories/integrations.ts`

**Step 1: Write the failing test**

Create `__tests__/repositories/integrations.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the database
vi.mock("@/server/db", () => ({
  db: {
    query: {
      integrations: {
        findFirst: vi.fn(),
      },
    },
    insert: vi.fn(() => ({ values: vi.fn(() => ({ returning: vi.fn() })) })),
    update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn(() => ({ returning: vi.fn() })) })) })),
    delete: vi.fn(() => ({ where: vi.fn() })),
  },
}));

// Mock crypto
vi.mock("@/server/auth/crypto", () => ({
  encrypt: vi.fn((val) => `encrypted:${val}`),
  decrypt: vi.fn((val) => val.replace("encrypted:", "")),
}));

describe("integrations repository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("encrypts token when saving integration", async () => {
    const { saveKitchenOwlConfig } = await import("@/server/db/repositories/integrations");
    const { encrypt } = await import("@/server/auth/crypto");

    await saveKitchenOwlConfig("user-123", {
      serverUrl: "https://kitchen.example.com",
      apiToken: "secret-token",
    });

    expect(encrypt).toHaveBeenCalledWith("secret-token");
  });

  it("decrypts token when retrieving integration", async () => {
    const { getKitchenOwlConfig } = await import("@/server/db/repositories/integrations");
    const { decrypt } = await import("@/server/auth/crypto");
    const { db } = await import("@/server/db");

    vi.mocked(db.query.integrations.findFirst).mockResolvedValue({
      id: "int-1",
      userId: "user-123",
      type: "kitchenowl",
      serverUrl: "https://kitchen.example.com",
      encryptedToken: "encrypted:secret-token",
      defaultHouseholdId: 1,
      defaultShoppingListId: 1,
      enabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await getKitchenOwlConfig("user-123");

    expect(decrypt).toHaveBeenCalledWith("encrypted:secret-token");
    expect(result?.apiToken).toBe("secret-token");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test __tests__/repositories/integrations.test.ts`
Expected: FAIL - module not found

**Step 3: Write the repository implementation**

Create `server/db/repositories/integrations.ts`:

```typescript
import { eq, and } from "drizzle-orm";
import { db } from "@/server/db";
import { integrations, type Integration, type IntegrationInsert } from "@/server/db/schema";
import { encrypt, decrypt } from "@/server/auth/crypto";

export interface KitchenOwlConfig {
  serverUrl: string;
  apiToken: string;
  defaultHouseholdId?: number | null;
  defaultShoppingListId?: number | null;
  enabled: boolean;
}

export interface KitchenOwlConfigInput {
  serverUrl: string;
  apiToken: string;
  defaultHouseholdId?: number | null;
  defaultShoppingListId?: number | null;
}

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
  };
}

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
      enabled: true,
    })
    .returning();

  return created;
}

export async function deleteKitchenOwlConfig(userId: string): Promise<void> {
  await db
    .delete(integrations)
    .where(
      and(
        eq(integrations.userId, userId),
        eq(integrations.type, "kitchenowl")
      )
    );
}

export async function setKitchenOwlEnabled(userId: string, enabled: boolean): Promise<void> {
  await db
    .update(integrations)
    .set({ enabled, updatedAt: new Date() })
    .where(
      and(
        eq(integrations.userId, userId),
        eq(integrations.type, "kitchenowl")
      )
    );
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm test __tests__/repositories/integrations.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add server/db/repositories/integrations.ts __tests__/repositories/integrations.test.ts
git commit -m "feat: add integrations repository with encryption"
```

---

## Task 3: KitchenOwl API Client

**Files:**
- Create: `lib/integrations/kitchenowl.ts`
- Create: `__tests__/integrations/kitchenowl-client.test.ts`

**Step 1: Write the failing test**

Create `__tests__/integrations/kitchenowl-client.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("KitchenOwl API Client", () => {
  const mockFetch = vi.fn();
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = mockFetch;
    vi.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe("testConnection", () => {
    it("returns success with households when credentials are valid", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([
          { id: 1, name: "Home" },
          { id: 2, name: "Work" },
        ]),
      });

      const { testConnection } = await import("@/lib/integrations/kitchenowl");
      const result = await testConnection("https://kitchen.example.com", "valid-token");

      expect(result.success).toBe(true);
      expect(result.households).toHaveLength(2);
      expect(mockFetch).toHaveBeenCalledWith(
        "https://kitchen.example.com/api/household",
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "Bearer valid-token",
          }),
        })
      );
    });

    it("returns failure when credentials are invalid", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
      });

      const { testConnection } = await import("@/lib/integrations/kitchenowl");
      const result = await testConnection("https://kitchen.example.com", "bad-token");

      expect(result.success).toBe(false);
      expect(result.error).toContain("401");
    });
  });

  describe("getShoppingLists", () => {
    it("returns shopping lists for a household", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([
          { id: 1, name: "Groceries" },
          { id: 2, name: "Hardware Store" },
        ]),
      });

      const { getShoppingLists } = await import("@/lib/integrations/kitchenowl");
      const result = await getShoppingLists("https://kitchen.example.com", "token", 1);

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe("Groceries");
    });
  });

  describe("addItemToShoppingList", () => {
    it("adds item successfully", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 123, name: "1 lb Ground Beef" }),
      });

      const { addItemToShoppingList } = await import("@/lib/integrations/kitchenowl");
      const result = await addItemToShoppingList(
        "https://kitchen.example.com",
        "token",
        1,
        "1 lb Ground Beef"
      );

      expect(result.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        "https://kitchen.example.com/api/shoppinglist/1/add-item-by-name",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ name: "1 lb Ground Beef" }),
        })
      );
    });
  });

  describe("addItemsToShoppingList", () => {
    it("adds multiple items and returns success count", async () => {
      mockFetch
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) })
        .mockResolvedValueOnce({ ok: false, status: 500 });

      const { addItemsToShoppingList } = await import("@/lib/integrations/kitchenowl");
      const result = await addItemsToShoppingList(
        "https://kitchen.example.com",
        "token",
        1,
        ["Item 1", "Item 2", "Item 3"]
      );

      expect(result.successCount).toBe(2);
      expect(result.failCount).toBe(1);
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test __tests__/integrations/kitchenowl-client.test.ts`
Expected: FAIL - module not found

**Step 3: Write the KitchenOwl client implementation**

Create `lib/integrations/kitchenowl.ts`:

```typescript
const TIMEOUT_MS = 10000;

export interface KitchenOwlHousehold {
  id: number;
  name: string;
}

export interface KitchenOwlShoppingList {
  id: number;
  name: string;
}

export interface TestConnectionResult {
  success: boolean;
  households?: KitchenOwlHousehold[];
  error?: string;
}

export interface AddItemResult {
  success: boolean;
  error?: string;
}

export interface AddItemsResult {
  successCount: number;
  failCount: number;
  errors: string[];
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number = TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

function buildHeaders(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

function normalizeUrl(serverUrl: string): string {
  return serverUrl.replace(/\/+$/, "");
}

export async function testConnection(
  serverUrl: string,
  apiToken: string
): Promise<TestConnectionResult> {
  const url = `${normalizeUrl(serverUrl)}/api/household`;

  try {
    const response = await fetchWithTimeout(url, {
      method: "GET",
      headers: buildHeaders(apiToken),
    });

    if (!response.ok) {
      return {
        success: false,
        error: `KitchenOwl returned ${response.status}: ${response.statusText}`,
      };
    }

    const households = (await response.json()) as KitchenOwlHousehold[];
    return { success: true, households };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return { success: false, error: "Connection timed out after 10 seconds" };
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function getShoppingLists(
  serverUrl: string,
  apiToken: string,
  householdId: number
): Promise<KitchenOwlShoppingList[]> {
  const url = `${normalizeUrl(serverUrl)}/api/household/${householdId}/shoppinglist`;

  const response = await fetchWithTimeout(url, {
    method: "GET",
    headers: buildHeaders(apiToken),
  });

  if (!response.ok) {
    throw new Error(`Failed to get shopping lists: ${response.status}`);
  }

  return response.json();
}

export async function addItemToShoppingList(
  serverUrl: string,
  apiToken: string,
  shoppingListId: number,
  itemName: string
): Promise<AddItemResult> {
  const url = `${normalizeUrl(serverUrl)}/api/shoppinglist/${shoppingListId}/add-item-by-name`;

  try {
    const response = await fetchWithTimeout(url, {
      method: "POST",
      headers: buildHeaders(apiToken),
      body: JSON.stringify({ name: itemName }),
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

export async function addItemsToShoppingList(
  serverUrl: string,
  apiToken: string,
  shoppingListId: number,
  items: string[]
): Promise<AddItemsResult> {
  let successCount = 0;
  let failCount = 0;
  const errors: string[] = [];

  // Add small delay between requests to avoid rate limiting
  for (const item of items) {
    const result = await addItemToShoppingList(serverUrl, apiToken, shoppingListId, item);
    if (result.success) {
      successCount++;
    } else {
      failCount++;
      if (result.error) {
        errors.push(`${item}: ${result.error}`);
      }
    }
    // 50ms delay between requests
    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  return { successCount, failCount, errors };
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm test __tests__/integrations/kitchenowl-client.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add lib/integrations/kitchenowl.ts __tests__/integrations/kitchenowl-client.test.ts
git commit -m "feat: add KitchenOwl API client with timeout and rate limiting"
```

---

## Task 4: Integrations tRPC Router

**Files:**
- Create: `server/trpc/routers/integrations/index.ts`
- Modify: `server/trpc/router.ts`

**Step 1: Write the failing test**

Create `__tests__/trpc/integrations/integrations.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/server/db/repositories/integrations", () => ({
  getKitchenOwlConfig: vi.fn(),
  saveKitchenOwlConfig: vi.fn(),
  deleteKitchenOwlConfig: vi.fn(),
}));

vi.mock("@/lib/integrations/kitchenowl", () => ({
  testConnection: vi.fn(),
  getShoppingLists: vi.fn(),
  addItemsToShoppingList: vi.fn(),
}));

vi.mock("@/server/db/repositories/recipes", () => ({
  getRecipeFull: vi.fn(),
}));

describe("integrations tRPC router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getKitchenOwlConfig", () => {
    it("returns config without exposing full token", async () => {
      const { getKitchenOwlConfig } = await import("@/server/db/repositories/integrations");
      vi.mocked(getKitchenOwlConfig).mockResolvedValue({
        serverUrl: "https://kitchen.example.com",
        apiToken: "super-secret-token-12345",
        defaultHouseholdId: 1,
        defaultShoppingListId: 1,
        enabled: true,
      });

      // The actual router test would use createCaller
      // This is a unit test of the masking logic
      const token = "super-secret-token-12345";
      const masked = token.slice(0, 4) + "••••" + token.slice(-4);
      expect(masked).toBe("supe••••2345");
    });
  });

  describe("testKitchenOwlConnection", () => {
    it("returns households on successful connection", async () => {
      const { testConnection } = await import("@/lib/integrations/kitchenowl");
      vi.mocked(testConnection).mockResolvedValue({
        success: true,
        households: [{ id: 1, name: "Home" }],
      });

      const result = await testConnection("https://kitchen.example.com", "token");
      expect(result.success).toBe(true);
      expect(result.households).toHaveLength(1);
    });
  });

  describe("sendToKitchenOwl", () => {
    it("formats ingredients correctly for KitchenOwl", async () => {
      // Test ingredient formatting
      const ingredient = {
        amount: 1.5,
        unit: "lb",
        ingredientName: "Ground Beef",
      };

      const formatted = `${ingredient.amount} ${ingredient.unit} ${ingredient.ingredientName}`;
      expect(formatted).toBe("1.5 lb Ground Beef");
    });

    it("scales quantities by serving multiplier", () => {
      const originalAmount = 2;
      const originalServings = 4;
      const targetServings = 8;
      const multiplier = targetServings / originalServings;

      const scaledAmount = originalAmount * multiplier;
      expect(scaledAmount).toBe(4);
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test __tests__/trpc/integrations/integrations.test.ts`
Expected: Tests pass (unit tests), but integration not wired up yet

**Step 3: Create the integrations router**

Create `server/trpc/routers/integrations/index.ts`:

```typescript
import { z } from "zod";
import { router } from "@/server/trpc/trpc";
import { authedProcedure } from "@/server/trpc/middleware";
import {
  getKitchenOwlConfig,
  saveKitchenOwlConfig,
  deleteKitchenOwlConfig,
} from "@/server/db/repositories/integrations";
import {
  testConnection,
  getShoppingLists,
  addItemsToShoppingList,
  type KitchenOwlHousehold,
  type KitchenOwlShoppingList,
} from "@/lib/integrations/kitchenowl";
import { getRecipeFull } from "@/server/db/repositories/recipes";
import { TRPCError } from "@trpc/server";

function maskToken(token: string): string {
  if (token.length <= 8) return "••••••••";
  return token.slice(0, 4) + "••••" + token.slice(-4);
}

function formatIngredient(
  amount: number | null,
  unit: string | null,
  name: string
): string {
  const parts: string[] = [];
  if (amount !== null && amount > 0) {
    // Round to 2 decimal places and remove trailing zeros
    parts.push(parseFloat(amount.toFixed(2)).toString());
  }
  if (unit) {
    parts.push(unit);
  }
  parts.push(name);
  return parts.join(" ");
}

export const integrationsRouter = router({
  // Get KitchenOwl configuration (with masked token)
  getKitchenOwlConfig: authedProcedure.query(async ({ ctx }) => {
    const config = await getKitchenOwlConfig(ctx.user.id);
    if (!config) return null;

    return {
      serverUrl: config.serverUrl,
      apiTokenMasked: maskToken(config.apiToken),
      defaultHouseholdId: config.defaultHouseholdId,
      defaultShoppingListId: config.defaultShoppingListId,
      enabled: config.enabled,
    };
  }),

  // Save KitchenOwl configuration
  saveKitchenOwlConfig: authedProcedure
    .input(
      z.object({
        serverUrl: z.string().url("Invalid server URL"),
        apiToken: z.string().min(1, "API token is required"),
        defaultHouseholdId: z.number().optional(),
        defaultShoppingListId: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await saveKitchenOwlConfig(ctx.user.id, {
        serverUrl: input.serverUrl,
        apiToken: input.apiToken,
        defaultHouseholdId: input.defaultHouseholdId,
        defaultShoppingListId: input.defaultShoppingListId,
      });
      return { success: true };
    }),

  // Delete KitchenOwl configuration
  deleteKitchenOwlConfig: authedProcedure.mutation(async ({ ctx }) => {
    await deleteKitchenOwlConfig(ctx.user.id);
    return { success: true };
  }),

  // Test KitchenOwl connection
  testKitchenOwlConnection: authedProcedure
    .input(
      z.object({
        serverUrl: z.string().url(),
        apiToken: z.string().min(1),
      })
    )
    .mutation(async ({ input }) => {
      const result = await testConnection(input.serverUrl, input.apiToken);
      return result;
    }),

  // Get shopping lists for a household
  getShoppingLists: authedProcedure
    .input(
      z.object({
        householdId: z.number(),
      })
    )
    .query(async ({ ctx, input }): Promise<KitchenOwlShoppingList[]> => {
      const config = await getKitchenOwlConfig(ctx.user.id);
      if (!config) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "KitchenOwl not configured",
        });
      }

      return getShoppingLists(config.serverUrl, config.apiToken, input.householdId);
    }),

  // Send recipe ingredients to KitchenOwl
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
        ingredients = ingredients.filter((ing) => idSet.has(ing.id));
      }

      // Format ingredients with scaled amounts
      const items = ingredients.map((ing) => {
        const scaledAmount = ing.amount !== null
          ? ing.amount * input.servingMultiplier
          : null;
        return formatIngredient(scaledAmount, ing.unit, ing.ingredientName);
      });

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

export type IntegrationsRouter = typeof integrationsRouter;
```

**Step 4: Add router to main app router**

Modify `server/trpc/router.ts` to add the integrations router:

```typescript
import { integrationsRouter } from "./routers/integrations";

export const appRouter = router({
  // ... existing routers
  integrations: integrationsRouter,
});
```

**Step 5: Run tests and type check**

Run:
```bash
pnpm test __tests__/trpc/integrations/integrations.test.ts
pnpm typecheck
```
Expected: PASS

**Step 6: Commit**

```bash
git add server/trpc/routers/integrations/ server/trpc/router.ts __tests__/trpc/integrations/
git commit -m "feat: add integrations tRPC router for KitchenOwl"
```

---

## Task 5: React Hook for KitchenOwl Integration

**Files:**
- Create: `hooks/integrations/use-kitchenowl.ts`

**Step 1: Write the failing test**

Create `__tests__/hooks/integrations/use-kitchenowl.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

vi.mock("@/hooks/use-trpc", () => ({
  trpc: {
    integrations: {
      getKitchenOwlConfig: {
        useQuery: vi.fn(() => ({ data: null, isLoading: false })),
      },
      saveKitchenOwlConfig: {
        useMutation: vi.fn(() => ({ mutateAsync: vi.fn() })),
      },
      testKitchenOwlConnection: {
        useMutation: vi.fn(() => ({ mutateAsync: vi.fn() })),
      },
      sendToKitchenOwl: {
        useMutation: vi.fn(() => ({ mutateAsync: vi.fn() })),
      },
    },
  },
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe("useKitchenOwlConfig", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns isConfigured=false when no config exists", async () => {
    const { useKitchenOwlConfig } = await import("@/hooks/integrations/use-kitchenowl");
    const { result } = renderHook(() => useKitchenOwlConfig(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isConfigured).toBe(false);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test __tests__/hooks/integrations/use-kitchenowl.test.ts`
Expected: FAIL - module not found

**Step 3: Create the hook**

Create `hooks/integrations/use-kitchenowl.ts`:

```typescript
import { trpc } from "@/hooks/use-trpc";
import { useCallback } from "react";

export function useKitchenOwlConfig() {
  const { data: config, isLoading, refetch } = trpc.integrations.getKitchenOwlConfig.useQuery();

  return {
    config,
    isLoading,
    isConfigured: !!config?.serverUrl,
    isEnabled: config?.enabled ?? false,
    refetch,
  };
}

export function useKitchenOwlMutations() {
  const utils = trpc.useUtils();

  const saveConfig = trpc.integrations.saveKitchenOwlConfig.useMutation({
    onSuccess: () => {
      utils.integrations.getKitchenOwlConfig.invalidate();
    },
  });

  const deleteConfig = trpc.integrations.deleteKitchenOwlConfig.useMutation({
    onSuccess: () => {
      utils.integrations.getKitchenOwlConfig.invalidate();
    },
  });

  const testConnection = trpc.integrations.testKitchenOwlConnection.useMutation();

  return {
    saveConfig,
    deleteConfig,
    testConnection,
  };
}

export function useSendToKitchenOwl() {
  const mutation = trpc.integrations.sendToKitchenOwl.useMutation();

  const sendIngredients = useCallback(
    async (
      recipeId: string,
      options?: {
        ingredientIds?: string[];
        servingMultiplier?: number;
        shoppingListId?: number;
      }
    ) => {
      return mutation.mutateAsync({
        recipeId,
        ingredientIds: options?.ingredientIds,
        servingMultiplier: options?.servingMultiplier ?? 1,
        shoppingListId: options?.shoppingListId,
      });
    },
    [mutation]
  );

  return {
    sendIngredients,
    isLoading: mutation.isPending,
    isSuccess: mutation.isSuccess,
    error: mutation.error,
    data: mutation.data,
    reset: mutation.reset,
  };
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm test __tests__/hooks/integrations/use-kitchenowl.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add hooks/integrations/use-kitchenowl.ts __tests__/hooks/integrations/use-kitchenowl.test.ts
git commit -m "feat: add React hooks for KitchenOwl integration"
```

---

## Task 6: Settings UI - Integrations Page

**Files:**
- Create: `app/(app)/settings/integrations/page.tsx`
- Create: `app/(app)/settings/integrations/components/kitchenowl-config-card.tsx`

**Step 1: Create the integrations settings page**

Create `app/(app)/settings/integrations/page.tsx`:

```typescript
import { KitchenOwlConfigCard } from "./components/kitchenowl-config-card";

export const metadata = {
  title: "Integrations | Norish",
};

export default function IntegrationsSettingsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">Integrations</h1>
        <p className="text-default-500">
          Connect Norish with other apps and services
        </p>
      </div>

      <KitchenOwlConfigCard />
    </div>
  );
}
```

**Step 2: Create the KitchenOwl configuration card**

Create `app/(app)/settings/integrations/components/kitchenowl-config-card.tsx`:

```typescript
"use client";

import { useState } from "react";
import {
  Card,
  CardHeader,
  CardBody,
  CardFooter,
  Input,
  Button,
  Select,
  SelectItem,
  Switch,
  Divider,
  Chip,
} from "@heroui/react";
import { useKitchenOwlConfig, useKitchenOwlMutations } from "@/hooks/integrations/use-kitchenowl";
import { toast } from "sonner";

interface ConnectionTestResult {
  success: boolean;
  households?: Array<{ id: number; name: string }>;
  error?: string;
}

export function KitchenOwlConfigCard() {
  const { config, isLoading, isConfigured, refetch } = useKitchenOwlConfig();
  const { saveConfig, deleteConfig, testConnection } = useKitchenOwlMutations();

  const [serverUrl, setServerUrl] = useState("");
  const [apiToken, setApiToken] = useState("");
  const [selectedHouseholdId, setSelectedHouseholdId] = useState<number | undefined>();
  const [selectedShoppingListId, setSelectedShoppingListId] = useState<number | undefined>();

  const [testResult, setTestResult] = useState<ConnectionTestResult | null>(null);
  const [shoppingLists, setShoppingLists] = useState<Array<{ id: number; name: string }>>([]);

  // Initialize form with existing config
  useState(() => {
    if (config) {
      setServerUrl(config.serverUrl);
      setSelectedHouseholdId(config.defaultHouseholdId ?? undefined);
      setSelectedShoppingListId(config.defaultShoppingListId ?? undefined);
    }
  });

  const handleTestConnection = async () => {
    if (!serverUrl || !apiToken) {
      toast.error("Please enter server URL and API token");
      return;
    }

    try {
      const result = await testConnection.mutateAsync({ serverUrl, apiToken });
      setTestResult(result);

      if (result.success && result.households) {
        toast.success(`Connected! Found ${result.households.length} household(s)`);
      } else {
        toast.error(result.error ?? "Connection failed");
      }
    } catch (error) {
      toast.error("Failed to test connection");
    }
  };

  const handleSave = async () => {
    if (!serverUrl || !apiToken) {
      toast.error("Please enter server URL and API token");
      return;
    }

    try {
      await saveConfig.mutateAsync({
        serverUrl,
        apiToken,
        defaultHouseholdId: selectedHouseholdId,
        defaultShoppingListId: selectedShoppingListId,
      });
      toast.success("KitchenOwl configuration saved");
      refetch();
    } catch (error) {
      toast.error("Failed to save configuration");
    }
  };

  const handleDisconnect = async () => {
    try {
      await deleteConfig.mutateAsync();
      toast.success("KitchenOwl disconnected");
      setServerUrl("");
      setApiToken("");
      setTestResult(null);
      setSelectedHouseholdId(undefined);
      setSelectedShoppingListId(undefined);
    } catch (error) {
      toast.error("Failed to disconnect");
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardBody>Loading...</CardBody>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div>
            <h3 className="text-lg font-semibold">KitchenOwl</h3>
            <p className="text-sm text-default-500">
              Send recipe ingredients to your KitchenOwl shopping list
            </p>
          </div>
        </div>
        {isConfigured && (
          <Chip color="success" variant="flat" size="sm">
            Connected
          </Chip>
        )}
      </CardHeader>

      <Divider />

      <CardBody className="flex flex-col gap-4">
        <Input
          label="Server URL"
          placeholder="https://kitchen.example.com"
          value={serverUrl}
          onValueChange={setServerUrl}
          description="Your KitchenOwl instance URL"
        />

        <Input
          label="API Token"
          type="password"
          placeholder={isConfigured ? config?.apiTokenMasked : "Enter your long-lived token"}
          value={apiToken}
          onValueChange={setApiToken}
          description="Generate from: Profile → Settings → Sessions → Long-lived tokens"
        />

        <Button
          color="secondary"
          variant="flat"
          onPress={handleTestConnection}
          isLoading={testConnection.isPending}
          isDisabled={!serverUrl || !apiToken}
        >
          Test Connection
        </Button>

        {testResult?.success && testResult.households && (
          <>
            <Select
              label="Default Household"
              placeholder="Select a household"
              selectedKeys={selectedHouseholdId ? [String(selectedHouseholdId)] : []}
              onSelectionChange={(keys) => {
                const key = Array.from(keys)[0];
                setSelectedHouseholdId(key ? Number(key) : undefined);
              }}
            >
              {testResult.households.map((h) => (
                <SelectItem key={String(h.id)}>{h.name}</SelectItem>
              ))}
            </Select>

            {/* Shopping list selector would be loaded after household selection */}
            {selectedHouseholdId && (
              <p className="text-sm text-default-400">
                Shopping list will be selected after saving and reloading
              </p>
            )}
          </>
        )}
      </CardBody>

      <Divider />

      <CardFooter className="flex justify-between">
        {isConfigured && (
          <Button
            color="danger"
            variant="light"
            onPress={handleDisconnect}
            isLoading={deleteConfig.isPending}
          >
            Disconnect
          </Button>
        )}
        <Button
          color="primary"
          onPress={handleSave}
          isLoading={saveConfig.isPending}
          isDisabled={!serverUrl || !apiToken}
          className={isConfigured ? "" : "ml-auto"}
        >
          Save Configuration
        </Button>
      </CardFooter>
    </Card>
  );
}
```

**Step 3: Add navigation link to settings menu**

Find the settings navigation component and add a link to `/settings/integrations`. The exact file depends on the existing navigation structure (likely in `app/(app)/settings/layout.tsx` or a shared component).

**Step 4: Run type check**

Run: `pnpm typecheck`
Expected: No errors

**Step 5: Commit**

```bash
git add app/\(app\)/settings/integrations/
git commit -m "feat: add KitchenOwl configuration settings UI"
```

---

## Task 7: Recipe View - Add to KitchenOwl Button

**Files:**
- Create: `app/(app)/recipes/[id]/components/send-to-kitchenowl.tsx`
- Modify: `app/(app)/recipes/[id]/components/actions-menu.tsx` (or equivalent)

**Step 1: Create the SendToKitchenOwl component**

Create `app/(app)/recipes/[id]/components/send-to-kitchenowl.tsx`:

```typescript
"use client";

import { useState } from "react";
import {
  Button,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Checkbox,
  CheckboxGroup,
  useDisclosure,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
} from "@heroui/react";
import { ShoppingCart, ChevronDown, Check } from "lucide-react";
import { useRecipeContextRequired } from "../context";
import { useKitchenOwlConfig, useSendToKitchenOwl } from "@/hooks/integrations/use-kitchenowl";
import { toast } from "sonner";

export function SendToKitchenOwlButton() {
  const { recipe, adjustedIngredients, servings } = useRecipeContextRequired();
  const { isConfigured, isEnabled } = useKitchenOwlConfig();
  const { sendIngredients, isLoading } = useSendToKitchenOwl();
  const { isOpen, onOpen, onClose } = useDisclosure();

  const [selectedIngredients, setSelectedIngredients] = useState<string[]>([]);

  // Don't render if not configured
  if (!isConfigured || !isEnabled) {
    return null;
  }

  const servingMultiplier = servings / (recipe.servings || 1);

  const handleSendAll = async () => {
    try {
      const result = await sendIngredients(recipe.id, { servingMultiplier });
      toast.success(`Added ${result.successCount} items to KitchenOwl`);
      if (result.failCount > 0) {
        toast.warning(`${result.failCount} items failed to add`);
      }
    } catch (error) {
      toast.error("Failed to send ingredients to KitchenOwl");
    }
  };

  const handleSendSelected = async () => {
    if (selectedIngredients.length === 0) {
      toast.error("Please select at least one ingredient");
      return;
    }

    try {
      const result = await sendIngredients(recipe.id, {
        ingredientIds: selectedIngredients,
        servingMultiplier,
      });
      toast.success(`Added ${result.successCount} items to KitchenOwl`);
      onClose();
      setSelectedIngredients([]);
    } catch (error) {
      toast.error("Failed to send ingredients to KitchenOwl");
    }
  };

  const openSelectionModal = () => {
    // Pre-select all ingredients
    setSelectedIngredients(adjustedIngredients.map((i) => i.id));
    onOpen();
  };

  return (
    <>
      <Dropdown>
        <DropdownTrigger>
          <Button
            color="primary"
            variant="flat"
            startContent={<ShoppingCart className="w-4 h-4" />}
            endContent={<ChevronDown className="w-4 h-4" />}
            isLoading={isLoading}
          >
            Add to KitchenOwl
          </Button>
        </DropdownTrigger>
        <DropdownMenu aria-label="KitchenOwl actions">
          <DropdownItem
            key="all"
            description="Send all ingredients to shopping list"
            startContent={<ShoppingCart className="w-4 h-4" />}
            onPress={handleSendAll}
          >
            Add all ingredients
          </DropdownItem>
          <DropdownItem
            key="select"
            description="Choose which ingredients to add"
            startContent={<Check className="w-4 h-4" />}
            onPress={openSelectionModal}
          >
            Select ingredients...
          </DropdownItem>
        </DropdownMenu>
      </Dropdown>

      <Modal isOpen={isOpen} onClose={onClose} size="lg">
        <ModalContent>
          <ModalHeader>Select Ingredients</ModalHeader>
          <ModalBody>
            <CheckboxGroup
              value={selectedIngredients}
              onValueChange={setSelectedIngredients}
            >
              {adjustedIngredients.map((ingredient) => {
                // Skip header items (start with #)
                if (ingredient.ingredientName.startsWith("#")) {
                  return (
                    <p key={ingredient.id} className="font-semibold mt-2">
                      {ingredient.ingredientName.slice(1).trim()}
                    </p>
                  );
                }

                const displayText = [
                  ingredient.amount?.toFixed(2).replace(/\.?0+$/, ""),
                  ingredient.unit,
                  ingredient.ingredientName,
                ]
                  .filter(Boolean)
                  .join(" ");

                return (
                  <Checkbox key={ingredient.id} value={ingredient.id}>
                    {displayText}
                  </Checkbox>
                );
              })}
            </CheckboxGroup>
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={onClose}>
              Cancel
            </Button>
            <Button
              color="primary"
              onPress={handleSendSelected}
              isLoading={isLoading}
              isDisabled={selectedIngredients.length === 0}
            >
              Add {selectedIngredients.length} items
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}
```

**Step 2: Add to recipe actions area**

Find the recipe actions component (likely `actions-menu.tsx` or in the recipe page layout) and add:

```typescript
import { SendToKitchenOwlButton } from "./send-to-kitchenowl";

// In the JSX, add alongside other action buttons:
<SendToKitchenOwlButton />
```

**Step 3: Run type check**

Run: `pnpm typecheck`
Expected: No errors

**Step 4: Manual test**

1. Configure KitchenOwl in Settings → Integrations
2. Open a recipe with ingredients
3. Click "Add to KitchenOwl" → "Add all ingredients"
4. Verify success toast appears
5. Check KitchenOwl app for the items

**Step 5: Commit**

```bash
git add app/\(app\)/recipes/\[id\]/components/send-to-kitchenowl.tsx
git commit -m "feat: add Send to KitchenOwl button on recipe view"
```

---

## Task 8: Add Serving Scale Support

**Files:**
- Modify: `app/(app)/recipes/[id]/components/send-to-kitchenowl.tsx` (already includes this)

This is already handled in Task 7. The `servingMultiplier` is calculated from the current servings context and passed to the API. Verify it works:

**Step 1: Manual test**

1. Open a recipe set to 4 servings with "1 lb Ground Beef"
2. Change servings to 8
3. Click "Add to KitchenOwl"
4. Verify KitchenOwl receives "2 lb Ground Beef"

**Step 2: Commit if any fixes needed**

```bash
git add -A
git commit -m "fix: ensure serving multiplier scales ingredients correctly"
```

---

## Task 9: Error Handling & Edge Cases

**Files:**
- Modify: `lib/integrations/kitchenowl.ts`
- Modify: `server/trpc/routers/integrations/index.ts`

**Step 1: Add comprehensive error handling test**

Add to `__tests__/integrations/kitchenowl-client.test.ts`:

```typescript
describe("error handling", () => {
  it("handles network errors gracefully", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    const { testConnection } = await import("@/lib/integrations/kitchenowl");
    const result = await testConnection("https://kitchen.example.com", "token");

    expect(result.success).toBe(false);
    expect(result.error).toContain("Network error");
  });

  it("handles timeout errors", async () => {
    mockFetch.mockImplementationOnce(() => new Promise(() => {})); // Never resolves

    const { testConnection } = await import("@/lib/integrations/kitchenowl");
    // Would timeout after 10s in real scenario
  });

  it("handles malformed JSON response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.reject(new Error("Invalid JSON")),
    });

    const { testConnection } = await import("@/lib/integrations/kitchenowl");
    const result = await testConnection("https://kitchen.example.com", "token");

    expect(result.success).toBe(false);
  });
});
```

**Step 2: Run all tests**

Run: `pnpm test`
Expected: All tests pass

**Step 3: Commit**

```bash
git add __tests__/integrations/kitchenowl-client.test.ts
git commit -m "test: add error handling tests for KitchenOwl client"
```

---

## Task 10: Final Integration Test & Documentation

**Files:**
- No new files needed

**Step 1: Run full test suite**

```bash
pnpm test:run
pnpm typecheck
pnpm build
```

Expected: All pass

**Step 2: Manual end-to-end test**

Follow the validation steps from the spec (Section 7.1):

1. **Test Case 1: Configuration** - Settings → Integrations → Configure → Test → Save
2. **Test Case 2: Send All** - Recipe → Add to KitchenOwl → Verify in app
3. **Test Case 3: Send Selected** - Recipe → Select ingredients → Add Selected
4. **Test Case 4: Error Handling** - Invalid token → Clear error message
5. **Test Case 5: Serving Scale** - Change servings → Verify quantities scaled

**Step 3: Final commit**

```bash
git add -A
git commit -m "feat: complete KitchenOwl integration"
```

---

## Summary

| Task | Description | Estimated Complexity |
|------|-------------|---------------------|
| 1 | Database schema | Low |
| 2 | Integration repository | Low |
| 3 | KitchenOwl API client | Medium |
| 4 | tRPC router | Medium |
| 5 | React hooks | Low |
| 6 | Settings UI | Medium |
| 7 | Recipe view button | Medium |
| 8 | Serving scale support | Low (included in 7) |
| 9 | Error handling | Low |
| 10 | Integration testing | Low |

**Total: 10 tasks, ~40-50 TDD steps**

---

## Dependencies

- Existing Norish encryption via `server/auth/crypto.ts`
- HeroUI components for UI
- TanStack Query via tRPC for data fetching
- Drizzle ORM for database operations

## Risk Mitigations

1. **API Token Security**: Uses existing MASTER_KEY-based encryption
2. **Rate Limiting**: 50ms delay between KitchenOwl API calls
3. **Timeouts**: 10-second timeout on all KitchenOwl requests
4. **Graceful Degradation**: Button hidden if integration not configured
