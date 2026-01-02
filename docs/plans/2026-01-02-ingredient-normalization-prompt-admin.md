# Ingredient Normalization Prompt Admin Setting

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the ingredient normalization prompt editable in admin settings alongside other AI prompts.

**Architecture:** Add `ingredientNormalization` field to the existing prompts config schema, update the loader to include it, add a textarea to the prompts form, and modify the normalizer service to fetch the prompt from config instead of disk.

**Tech Stack:** TypeScript, Zod, React, tRPC, Drizzle ORM

---

## Task 1: Update Prompts Schema

**Files:**
- Modify: `server/db/zodSchemas/server-config.ts:81-91`

**Step 1: Add ingredientNormalization to PromptsConfigSchema**

```typescript
export const PromptsConfigSchema = z.object({
  recipeExtraction: z.string(),
  unitConversion: z.string(),
  nutritionEstimation: z.string(),
  ingredientNormalization: z.string(),
  isOverridden: z.boolean().default(false),
});
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors related to PromptsConfig type

---

## Task 2: Update Prompt Loader

**Files:**
- Modify: `server/ai/prompts/loader.ts`

**Step 1: Update loadDefaultPrompts to include ingredientNormalization**

```typescript
export function loadDefaultPrompts(): PromptsConfigInput {
  return {
    recipeExtraction: readFileSync(join(PROMPTS_DIR, "recipe-extraction.txt"), "utf-8"),
    unitConversion: readFileSync(join(PROMPTS_DIR, "unit-conversion.txt"), "utf-8"),
    nutritionEstimation: readFileSync(join(PROMPTS_DIR, "nutrition-estimation.txt"), "utf-8"),
    ingredientNormalization: readFileSync(join(PROMPTS_DIR, "ingredient-normalization.txt"), "utf-8"),
  };
}
```

**Step 2: Update loadPrompt to support ingredient-normalization**

```typescript
export async function loadPrompt(
  name: "recipe-extraction" | "unit-conversion" | "nutrition-estimation" | "ingredient-normalization"
): Promise<string> {
  const prompts = await getPrompts();

  switch (name) {
    case "recipe-extraction":
      return prompts.recipeExtraction;

    case "nutrition-estimation":
      return prompts.nutritionEstimation;

    case "unit-conversion":
      return prompts.unitConversion;

    case "ingredient-normalization":
      return prompts.ingredientNormalization;
  }
}
```

**Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

---

## Task 3: Update Normalizer Service

**Files:**
- Modify: `server/services/ingredient-normalizer.ts`

**Step 1: Remove disk-based prompt loading**

Remove these lines:
```typescript
import { readFileSync } from "fs";
import { join } from "path";

const PROMPT_PATH = join(process.cwd(), "server", "ai", "prompts", "ingredient-normalization.txt");
```

**Step 2: Add import for loadPrompt**

```typescript
import { loadPrompt } from "@/server/ai/prompts/loader";
```

**Step 3: Update aiNormalize to use loadPrompt**

Change:
```typescript
const prompt = readFileSync(PROMPT_PATH, "utf-8");
```

To:
```typescript
const prompt = await loadPrompt("ingredient-normalization");
```

**Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

---

## Task 4: Update Admin UI Form

**Files:**
- Modify: `app/(app)/settings/admin/components/prompts-form.tsx`

**Step 1: Add state for ingredientNormalization**

Add to state declarations (after line 16):
```typescript
const [ingredientNormalization, setIngredientNormalization] = useState("");
```

**Step 2: Initialize from context**

Update the useEffect (lines 22-28):
```typescript
useEffect(() => {
  if (prompts) {
    setRecipeExtraction(prompts.recipeExtraction);
    setUnitConversion(prompts.unitConversion);
    setNutritionEstimation(prompts.nutritionEstimation);
    setIngredientNormalization(prompts.ingredientNormalization);
  }
}, [prompts]);
```

**Step 3: Update change tracking**

Update the hasChanges useEffect (lines 31-40):
```typescript
useEffect(() => {
  if (prompts) {
    const changed =
      recipeExtraction !== prompts.recipeExtraction ||
      unitConversion !== prompts.unitConversion ||
      nutritionEstimation !== prompts.nutritionEstimation ||
      ingredientNormalization !== prompts.ingredientNormalization;

    setHasChanges(changed);
  }
}, [recipeExtraction, unitConversion, nutritionEstimation, ingredientNormalization, prompts]);
```

**Step 4: Update handleSave**

Update handleSave (lines 42-51):
```typescript
const handleSave = async () => {
  setSaving(true);
  await updatePrompts({
    recipeExtraction,
    unitConversion,
    nutritionEstimation,
    ingredientNormalization,
  }).finally(() => {
    setSaving(false);
  });
};
```

**Step 5: Add textarea for ingredientNormalization**

Add after the Nutrition Estimation textarea (before line 108):
```tsx
<div className="flex flex-col gap-2">
  <Textarea
    description="This prompt is used when normalizing ingredient names for shopping list integrations."
    label="Ingredient Normalization Prompt"
    maxRows={15}
    minRows={6}
    placeholder="Enter the ingredient normalization prompt..."
    value={ingredientNormalization}
    onValueChange={setIngredientNormalization}
  />
</div>
```

**Step 6: Verify the app builds**

Run: `npm run build`
Expected: Build succeeds

---

## Task 5: Delete Old Prompt File

**Files:**
- Delete: `server/ai/prompts/ingredient-normalization.txt`

**Step 1: Delete the file**

Run: `rm server/ai/prompts/ingredient-normalization.txt`

**Step 2: Verify no references remain**

Run: `grep -r "ingredient-normalization.txt" --include="*.ts" --include="*.tsx"`
Expected: No results

---

## Task 6: Final Verification

**Step 1: Run full build**

Run: `npm run build`
Expected: Build succeeds with no errors

**Step 2: Run linter**

Run: `npm run lint`
Expected: No new lint errors

**Step 3: Commit**

```bash
git add -A
git commit -m "feat(admin): add ingredient normalization prompt to admin settings

- Add ingredientNormalization field to PromptsConfigSchema
- Update loader to include ingredient normalization prompt
- Add textarea to prompts form in admin settings
- Update normalizer service to fetch prompt from config
- Remove disk-based prompt file

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```
