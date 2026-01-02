# Ingredient Cache Management Design

## Overview

Add cache management UI to the ingredient normalization section of the admin panel, allowing admins to view, edit, delete, and add cached ingredient name mappings, plus reset the entire cache.

## UI Layout

Located within the existing Ingredient Normalization section, below current settings:

### Cache Management Area

- **Header row**: "Cached Mappings" with entry count badge + "Reset Cache" button (right-aligned)
- **Table columns**:
  - "Original Name" - the raw ingredient name (read-only, serves as key)
  - "Normalized Name" - the cleaned name (editable)
  - "Source" - badge showing "AI", "Manual", or "Fallback" (read-only)
  - "Created" - relative time display (read-only)
  - Actions - edit/delete icons
- **Add row**: First row is always an empty inline form (Original + Normalized inputs, Save button)
- **Pagination**: For large datasets

### Behaviors

- Edit: Inline editing of Normalized Name only
- Delete: Immediate removal, no confirmation
- Reset: Clears all entries immediately, no confirmation (cache is easily rebuilt)

## Backend API

New tRPC router: `admin.ingredientCache`

### Queries

```typescript
// List paginated entries with optional search
admin.ingredientCache.list
  Input: { page?: number, limit?: number, search?: string }
  Returns: { entries: IngredientNameMapping[], total: number }
```

### Mutations

```typescript
// Create new manual mapping
admin.ingredientCache.add
  Input: { rawName: string, normalizedName: string }
  Source: automatically set to "manual"

// Update normalized name
admin.ingredientCache.update
  Input: { id: string, normalizedName: string }
  Updates: updatedAt timestamp

// Remove single entry
admin.ingredientCache.delete
  Input: { id: string }

// Delete all entries (reset cache)
admin.ingredientCache.clear
  Returns: { count: number } // deleted entries count
```

## Implementation Files

### Backend

**New file: `server/trpc/routers/admin/ingredient-cache.ts`**
- tRPC router with all cache management procedures

**Extend: `server/db/repositories/ingredient-mappings.ts`**
- `listMappings(page, limit, search)` - Paginated list with optional search
- `addMapping(rawName, normalizedName)` - Insert with source="manual"
- `updateMapping(id, normalizedName)` - Update normalized name
- `deleteMapping(id)` - Delete single entry
- `clearAllMappings()` - Delete all, return count

**Update: `server/trpc/routers/admin/index.ts`**
- Import and add ingredientCache router

### Frontend

**Extend: `app/(app)/settings/admin/components/ingredient-normalization-form.tsx`**
- Add cache management table below current form
- Inline add row at top of table
- Edit/delete actions per row
- Reset cache button in header

**New file: `hooks/admin/use-ingredient-cache.ts`**
- `useIngredientCacheQuery(page, search)` - List query with pagination
- `useIngredientCacheMutations()` - add, update, delete, clear mutations

## Data Model

Existing table `ingredient_name_mappings`:
- `id` (uuid, primary key)
- `rawName` (text, unique) - original ingredient name, lowercased
- `normalizedName` (text) - cleaned ingredient name
- `source` (text) - "ai" | "fallback" | "manual"
- `createdAt` (timestamp)
- `updatedAt` (timestamp)
