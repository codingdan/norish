# Ingredient Cache Management Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add cache management UI to the ingredient normalization admin section with reset, view, edit, delete, and add functionality.

**Architecture:** Backend tRPC router with CRUD procedures calling repository functions. Frontend React hook for data fetching, inline table component for viewing/editing entries.

**Tech Stack:** Drizzle ORM, tRPC, React Query, HeroUI components

---

## Task 1: Repository Functions

**Files:**
- Modify: `server/db/repositories/ingredient-mappings.ts:40-55`

**Step 1: Add imports for SQL operations**

Add to existing imports at line 1:

```typescript
import { inArray, eq, ilike, sql, count, desc } from "drizzle-orm";
```

**Step 2: Add listMappings function**

Add after `saveMappings` function (after line 55):

```typescript
/**
 * List paginated ingredient mappings with optional search.
 */
export async function listMappings(
  page: number = 1,
  limit: number = 20,
  search?: string
): Promise<{ entries: IngredientNameMapping[]; total: number }> {
  const offset = (page - 1) * limit;

  const whereClause = search
    ? ilike(ingredientNameMappings.rawName, `%${search}%`)
    : undefined;

  const [entries, totalResult] = await Promise.all([
    db.query.ingredientNameMappings.findMany({
      where: whereClause,
      orderBy: desc(ingredientNameMappings.createdAt),
      limit,
      offset,
    }),
    db
      .select({ count: count() })
      .from(ingredientNameMappings)
      .where(whereClause),
  ]);

  return { entries, total: totalResult[0]?.count ?? 0 };
}
```

**Step 3: Add addMapping function**

```typescript
/**
 * Add a manual ingredient mapping.
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
```

**Step 4: Add updateMapping function**

```typescript
/**
 * Update the normalized name for a mapping.
 */
export async function updateMapping(
  id: string,
  normalizedName: string
): Promise<void> {
  await db
    .update(ingredientNameMappings)
    .set({
      normalizedName: normalizedName.trim(),
      updatedAt: new Date(),
    })
    .where(eq(ingredientNameMappings.id, id));
}
```

**Step 5: Add deleteMapping function**

```typescript
/**
 * Delete a single mapping by ID.
 */
export async function deleteMapping(id: string): Promise<void> {
  await db
    .delete(ingredientNameMappings)
    .where(eq(ingredientNameMappings.id, id));
}
```

**Step 6: Add clearAllMappings function**

```typescript
/**
 * Delete all mappings. Returns count of deleted entries.
 */
export async function clearAllMappings(): Promise<number> {
  const result = await db.delete(ingredientNameMappings).returning({ id: ingredientNameMappings.id });
  return result.length;
}
```

**Step 7: Add type export**

Add to imports at top:

```typescript
import { ingredientNameMappings, type IngredientNameMappingInsert, type IngredientNameMapping } from "../schema";
```

**Step 8: Commit**

```bash
git add server/db/repositories/ingredient-mappings.ts
git commit -m "feat(repo): add CRUD functions for ingredient mappings"
```

---

## Task 2: tRPC Router

**Files:**
- Create: `server/trpc/routers/admin/ingredient-cache.ts`

**Step 1: Create the router file**

```typescript
import { z } from "zod";
import { router, adminProcedure } from "../../trpc";
import {
  listMappings,
  addMapping,
  updateMapping,
  deleteMapping,
  clearAllMappings,
} from "@/server/db/repositories/ingredient-mappings";

export const ingredientCacheRouter = router({
  list: adminProcedure
    .input(
      z.object({
        page: z.number().min(1).default(1),
        limit: z.number().min(1).max(100).default(20),
        search: z.string().optional(),
      })
    )
    .query(async ({ input }) => {
      return listMappings(input.page, input.limit, input.search);
    }),

  add: adminProcedure
    .input(
      z.object({
        rawName: z.string().min(1),
        normalizedName: z.string().min(1),
      })
    )
    .mutation(async ({ input }) => {
      const entry = await addMapping(input.rawName, input.normalizedName);
      return { success: true, entry };
    }),

  update: adminProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        normalizedName: z.string().min(1),
      })
    )
    .mutation(async ({ input }) => {
      await updateMapping(input.id, input.normalizedName);
      return { success: true };
    }),

  delete: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input }) => {
      await deleteMapping(input.id);
      return { success: true };
    }),

  clear: adminProcedure.mutation(async () => {
    const count = await clearAllMappings();
    return { success: true, count };
  }),
});
```

**Step 2: Commit**

```bash
git add server/trpc/routers/admin/ingredient-cache.ts
git commit -m "feat(trpc): add ingredient cache admin router"
```

---

## Task 3: Register Router

**Files:**
- Modify: `server/trpc/routers/admin/index.ts`

**Step 1: Add import**

Add after line 9:

```typescript
import { ingredientCacheRouter } from "./ingredient-cache";
```

**Step 2: Add to router**

Add after line 31 (before the closing `});`):

```typescript
  // Ingredient cache management
  ingredientCache: ingredientCacheRouter,
```

**Step 3: Commit**

```bash
git add server/trpc/routers/admin/index.ts
git commit -m "feat(admin): register ingredient cache router"
```

---

## Task 4: React Hook

**Files:**
- Create: `hooks/admin/use-ingredient-cache.ts`

**Step 1: Create the hook file**

```typescript
"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/app/providers/trpc-provider";

export function useIngredientCache(page: number = 1, search?: string) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const queryKey = trpc.admin.ingredientCache.list.queryKey({ page, limit: 20, search });

  const { data, isLoading, error } = useQuery(
    trpc.admin.ingredientCache.list.queryOptions({ page, limit: 20, search })
  );

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: trpc.admin.ingredientCache.list.queryKey() });
  };

  const addMutation = useMutation({
    ...trpc.admin.ingredientCache.add.mutationOptions(),
    onSuccess: invalidate,
  });

  const updateMutation = useMutation({
    ...trpc.admin.ingredientCache.update.mutationOptions(),
    onSuccess: invalidate,
  });

  const deleteMutation = useMutation({
    ...trpc.admin.ingredientCache.delete.mutationOptions(),
    onSuccess: invalidate,
  });

  const clearMutation = useMutation({
    ...trpc.admin.ingredientCache.clear.mutationOptions(),
    onSuccess: invalidate,
  });

  return {
    entries: data?.entries ?? [],
    total: data?.total ?? 0,
    isLoading,
    error,
    add: addMutation.mutateAsync,
    update: updateMutation.mutateAsync,
    delete: deleteMutation.mutateAsync,
    clear: clearMutation.mutateAsync,
    isAdding: addMutation.isPending,
    isClearing: clearMutation.isPending,
  };
}
```

**Step 2: Export from index**

Add to `hooks/admin/index.ts`:

```typescript
export { useIngredientCache } from "./use-ingredient-cache";
```

**Step 3: Commit**

```bash
git add hooks/admin/use-ingredient-cache.ts hooks/admin/index.ts
git commit -m "feat(hooks): add useIngredientCache hook"
```

---

## Task 5: Cache Table Component

**Files:**
- Create: `app/(app)/settings/admin/components/ingredient-cache-table.tsx`

**Step 1: Create the component**

```typescript
"use client";

import { useState } from "react";
import {
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Input,
  Button,
  Chip,
  Pagination,
  Spinner,
} from "@heroui/react";
import { PencilIcon, TrashIcon, CheckIcon, XMarkIcon, PlusIcon } from "@heroicons/react/24/outline";
import { useIngredientCache } from "@/hooks/admin";
import type { IngredientNameMapping } from "@/server/db/schema";

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 30) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

const sourceColors: Record<string, "primary" | "secondary" | "success"> = {
  ai: "primary",
  manual: "success",
  fallback: "secondary",
};

export default function IngredientCacheTable() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [newRaw, setNewRaw] = useState("");
  const [newNormalized, setNewNormalized] = useState("");

  const {
    entries,
    total,
    isLoading,
    add,
    update,
    delete: deleteEntry,
    clear,
    isAdding,
    isClearing,
  } = useIngredientCache(page, search || undefined);

  const totalPages = Math.ceil(total / 20);

  const handleEdit = (entry: IngredientNameMapping) => {
    setEditingId(entry.id);
    setEditValue(entry.normalizedName);
  };

  const handleSaveEdit = async () => {
    if (editingId && editValue.trim()) {
      await update({ id: editingId, normalizedName: editValue.trim() });
      setEditingId(null);
      setEditValue("");
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditValue("");
  };

  const handleAdd = async () => {
    if (newRaw.trim() && newNormalized.trim()) {
      await add({ rawName: newRaw.trim(), normalizedName: newNormalized.trim() });
      setNewRaw("");
      setNewNormalized("");
    }
  };

  const handleDelete = async (id: string) => {
    await deleteEntry({ id });
  };

  const handleClear = async () => {
    await clear();
    setPage(1);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <h4 className="text-sm font-medium">Cached Mappings</h4>
          <Chip size="sm" variant="flat">{total}</Chip>
        </div>
        <div className="flex items-center gap-2">
          <Input
            size="sm"
            placeholder="Search..."
            value={search}
            onValueChange={setSearch}
            className="w-48"
          />
          <Button
            size="sm"
            color="danger"
            variant="flat"
            onPress={handleClear}
            isLoading={isClearing}
          >
            Reset Cache
          </Button>
        </div>
      </div>

      {/* Add new entry row */}
      <div className="flex items-center gap-2 p-2 bg-default-50 rounded-lg">
        <Input
          size="sm"
          placeholder="Original name"
          value={newRaw}
          onValueChange={setNewRaw}
          className="flex-1"
        />
        <Input
          size="sm"
          placeholder="Normalized name"
          value={newNormalized}
          onValueChange={setNewNormalized}
          className="flex-1"
        />
        <Button
          size="sm"
          color="primary"
          isIconOnly
          onPress={handleAdd}
          isLoading={isAdding}
          isDisabled={!newRaw.trim() || !newNormalized.trim()}
        >
          <PlusIcon className="h-4 w-4" />
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Spinner />
        </div>
      ) : entries.length === 0 ? (
        <div className="text-center py-8 text-default-500">
          {search ? "No matching entries found" : "No cached mappings yet"}
        </div>
      ) : (
        <>
          <Table aria-label="Ingredient cache entries" removeWrapper>
            <TableHeader>
              <TableColumn>ORIGINAL</TableColumn>
              <TableColumn>NORMALIZED</TableColumn>
              <TableColumn width={80}>SOURCE</TableColumn>
              <TableColumn width={100}>CREATED</TableColumn>
              <TableColumn width={80}>ACTIONS</TableColumn>
            </TableHeader>
            <TableBody>
              {entries.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell className="font-mono text-sm">{entry.rawName}</TableCell>
                  <TableCell>
                    {editingId === entry.id ? (
                      <Input
                        size="sm"
                        value={editValue}
                        onValueChange={setEditValue}
                        autoFocus
                      />
                    ) : (
                      <span className="font-mono text-sm">{entry.normalizedName}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Chip size="sm" color={sourceColors[entry.source]} variant="flat">
                      {entry.source}
                    </Chip>
                  </TableCell>
                  <TableCell className="text-xs text-default-500">
                    {formatRelativeTime(new Date(entry.createdAt))}
                  </TableCell>
                  <TableCell>
                    {editingId === entry.id ? (
                      <div className="flex gap-1">
                        <Button size="sm" isIconOnly variant="light" onPress={handleSaveEdit}>
                          <CheckIcon className="h-4 w-4 text-success" />
                        </Button>
                        <Button size="sm" isIconOnly variant="light" onPress={handleCancelEdit}>
                          <XMarkIcon className="h-4 w-4 text-danger" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex gap-1">
                        <Button size="sm" isIconOnly variant="light" onPress={() => handleEdit(entry)}>
                          <PencilIcon className="h-4 w-4" />
                        </Button>
                        <Button size="sm" isIconOnly variant="light" onPress={() => handleDelete(entry.id)}>
                          <TrashIcon className="h-4 w-4 text-danger" />
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {totalPages > 1 && (
            <div className="flex justify-center">
              <Pagination
                total={totalPages}
                page={page}
                onChange={setPage}
                size="sm"
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add app/(app)/settings/admin/components/ingredient-cache-table.tsx
git commit -m "feat(ui): add ingredient cache table component"
```

---

## Task 6: Integrate into Form

**Files:**
- Modify: `app/(app)/settings/admin/components/ingredient-normalization-form.tsx`

**Step 1: Add import at top**

Add after line 4:

```typescript
import IngredientCacheTable from "./ingredient-cache-table";
```

**Step 2: Add cache table section**

Replace lines 92-98 with:

```typescript
      <div className="border-t border-default-200 pt-4 space-y-4">
        <IngredientCacheTable />
        <p className="text-xs text-default-400">
          When AI normalization is disabled, a local regex-based fallback is
          used to strip quantities and modifiers from ingredient names.
        </p>
      </div>
```

**Step 3: Commit**

```bash
git add app/(app)/settings/admin/components/ingredient-normalization-form.tsx
git commit -m "feat(admin): integrate cache table into normalization form"
```

---

## Task 7: Final Verification

**Step 1: Run type check**

```bash
pnpm tsc --noEmit
```

**Step 2: Run lint**

```bash
pnpm lint
```

**Step 3: Start dev server and test manually**

```bash
pnpm dev
```

Navigate to Settings > Admin > AI Processing > Ingredient Normalization and verify:
- Cache table displays with entry count
- Search filters entries
- Add new entry works
- Edit inline works
- Delete removes entry
- Reset Cache clears all entries

**Step 4: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: address any issues from verification"
```
