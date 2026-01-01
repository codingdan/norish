# KitchenOwl Ingredient Normalization

## Problem

When sending ingredients to KitchenOwl, we currently send full strings like "1 onion (diced)". This doesn't match well with KitchenOwl's item taxonomy. We need to send clean ingredient names (e.g., "onion") with quantity in the description field.

## Solution

AI-powered ingredient name normalization with caching and local fallback.

## Design

### Database Schema

```sql
CREATE TABLE ingredient_name_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  raw_name TEXT NOT NULL UNIQUE,      -- "onion (diced)", case-normalized
  normalized_name TEXT NOT NULL,       -- "onion"
  source TEXT NOT NULL,                -- "ai" | "fallback" | "manual"
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_ingredient_mappings_raw ON ingredient_name_mappings(raw_name);
```

- `raw_name`: unique, lowercased for consistent lookups
- `source`: tracks origin (ai/fallback/manual) for future review UI
- Global cache (not per-user)

### Normalization Flow

```
1. Check cache for normalized name
2. If cached → use it
3. If not cached → try AI batch call
   - Success → cache results with source="ai", use them
   - Failure → use local fallback, DON'T cache (retry AI next time)
```

### AI Batch Normalization

Single prompt for all uncached ingredients in a recipe:

```
You are an ingredient name normalizer for a grocery shopping list.

For each ingredient, extract ONLY the base ingredient name that would match
a grocery store's product taxonomy. Remove:
- Quantities and measurements
- Preparation instructions (diced, chopped, minced)
- Sizes (large, small, medium)
- Freshness descriptors (fresh, frozen) - UNLESS it changes the product
  (e.g., "frozen peas" is different from "peas")

Input: ["onion (diced)", "2 cloves garlic", "fresh basil leaves"]

Output as JSON: {"onion (diced)": "onion", "2 cloves garlic": "garlic", ...}
```

- Reuses existing AI API key from global settings
- Separate model selection for normalization (default: gpt-4o-mini)

### Local Fallback

Applied when AI is unavailable or disabled:

```typescript
function localNormalize(ingredientName: string): string {
  let name = ingredientName.trim();

  // 1. Strip parenthetical suffixes: "(diced)", "(to taste)", "(optional)"
  name = name.replace(/\s*\([^)]*\)\s*$/, "");

  // 2. Strip trailing comma phrases: ", minced", ", for garnish"
  name = name.replace(/,\s*[^,]+$/, "");

  // 3. Strip leading quantities: "2 cloves garlic" → "garlic"
  name = name.replace(/^\d+[\d./]*\s*(oz|lb|g|kg|ml|l|cups?|tbsp|tsp|cloves?|pieces?|slices?|heads?|stalks?|sprigs?|cans?|bunch|bunches)?\s*(of\s+)?/i, "");

  // 4. Trim and normalize whitespace
  name = name.replace(/\s+/g, " ").trim();

  return name || ingredientName;
}
```

Fallback results are NOT cached (AI will retry next time).

### KitchenOwl API

Update to use separate name and description fields:

```typescript
// API accepts: { name: string, description?: string }

addItemToShoppingList(serverUrl, apiToken, listId, "onion", "1")
addItemToShoppingList(serverUrl, apiToken, listId, "beef broth", "250ml")
```

Description = quantity only (amount + unit). Prep instructions discarded.

### Settings UI

New settings in KitchenOwl integration config:

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| enableNormalization | boolean | true | Master toggle for any name cleanup |
| useAiNormalization | boolean | true | Use AI normalization (requires AI enabled globally) |
| normalizationModel | string | "" (empty) | Model override; empty = use global AI model |

**Note:** Model is a free-form text input (not dropdown) to support all providers (OpenAI, Ollama, LM Studio, etc.). Matches existing AI config pattern.

Behavior matrix:

| enableNormalization | useAiNormalization | Result |
|---------------------|-------------------|--------|
| off | - | Send raw: "1 onion (diced)" |
| on | off | Local fallback only |
| on | on | AI with cache, fallback if AI fails |

### Integration Flow (tRPC)

Updated `sendToKitchenOwl` mutation:

1. Fetch recipe ingredients
2. Filter by selected IDs (if applicable)
3. Scale amounts by servingMultiplier
4. Collect unique ingredientNames → lookup cache
5. For uncached names → batch AI call (or fallback)
6. Cache new AI mappings
7. For each ingredient:
   - normalized_name = cache[ingredientName] or fallback
   - description = formatDescription(scaledAmount, unit)
   - call addItemToShoppingList(name, description)
8. Return success/fail counts

### File Structure

- `server/db/schema/ingredient-mappings.ts` - Drizzle schema
- `server/db/repositories/ingredient-mappings.ts` - DB operations
- `server/services/ingredient-normalizer.ts` - Normalization logic
- `server/ai/prompts/ingredient-normalization.txt` - AI prompt
- Update `server/trpc/routers/integrations/index.ts` - Use normalizer
- Update `lib/integrations/kitchenowl.ts` - Add description param
- Update `app/(app)/settings/integrations/components/kitchenowl-config-card.tsx` - New settings

## Future Enhancements

- Admin UI to view/edit/delete cached mappings
- Manual override capability for specific ingredients
- Simple deterministic optimization (skip AI for trivially clean names)
