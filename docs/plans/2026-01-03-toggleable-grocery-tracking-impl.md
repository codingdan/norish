# Toggleable Grocery Tracking Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the built-in grocery list toggleable via admin settings, hiding navigation and local grocery buttons when disabled while preserving KitchenOwl integration functionality.

**Architecture:** Add `GROCERY_TRACKING_ENABLED` to server config with a public endpoint for feature flags. Create a `FeatureFlagsProvider` at the app layout level. Conditionally render navigation items and grocery buttons based on the flag combined with KitchenOwl configuration status.

**Tech Stack:** Next.js, tRPC, Drizzle ORM, React Context, HeroUI components

---

## Task 1: Add Server Config Key

**Files:**
- Modify: `server/db/zodSchemas/server-config.ts`

**Step 1: Add the config key constant**

In `server/db/zodSchemas/server-config.ts`, add to the `ServerConfigKeys` object:

```typescript
export const ServerConfigKeys = {
  REGISTRATION_ENABLED: "registration_enabled",
  PASSWORD_AUTH_ENABLED: "password_auth_enabled",
  // ... existing keys ...
  PROMPTS: "prompts",
  GROCERY_TRACKING_ENABLED: "grocery_tracking_enabled", // ADD THIS
} as const;
```

**Step 2: Add schema validation case**

In the `getSchemaForConfigKey` function, add:

```typescript
case ServerConfigKeys.GROCERY_TRACKING_ENABLED:
  return z.boolean();
```

**Step 3: Commit**

```bash
git add server/db/zodSchemas/server-config.ts
git commit -m "feat(config): add GROCERY_TRACKING_ENABLED server config key"
```

---

## Task 2: Create Public Feature Flags Endpoint

**Files:**
- Create: `server/trpc/routers/feature-flags.ts`
- Modify: `server/trpc/routers/index.ts`

**Step 1: Create the feature flags router**

Create `server/trpc/routers/feature-flags.ts`:

```typescript
import { router, publicProcedure } from "../trpc";

import { getConfig } from "@/server/db/repositories/server-config";
import { ServerConfigKeys } from "@/server/db/zodSchemas/server-config";

/**
 * Public feature flags endpoint.
 * Returns app-wide feature configuration that doesn't require authentication.
 */
const getFeatureFlags = publicProcedure.query(async () => {
  const groceryTrackingEnabled = await getConfig<boolean>(
    ServerConfigKeys.GROCERY_TRACKING_ENABLED
  );

  return {
    // Default to true if not set (backwards compatible)
    groceryTrackingEnabled: groceryTrackingEnabled ?? true,
  };
});

export const featureFlagsRouter = router({
  getFeatureFlags,
});
```

**Step 2: Add to main router**

In `server/trpc/routers/index.ts`, import and add the router:

```typescript
import { featureFlagsRouter } from "./feature-flags";

export const appRouter = router({
  // ... existing routers ...
  featureFlags: featureFlagsRouter,
});
```

**Step 3: Commit**

```bash
git add server/trpc/routers/feature-flags.ts server/trpc/routers/index.ts
git commit -m "feat(api): add public feature flags endpoint"
```

---

## Task 3: Create Feature Flags Hook and Provider

**Files:**
- Create: `hooks/use-feature-flags.ts`
- Create: `context/feature-flags-context.tsx`

**Step 1: Create the hook**

Create `hooks/use-feature-flags.ts`:

```typescript
"use client";

import { useQuery } from "@tanstack/react-query";

import { useTRPC } from "@/app/providers/trpc-provider";

export type FeatureFlags = {
  groceryTrackingEnabled: boolean;
};

/**
 * Hook for accessing public feature flags.
 * Can be used anywhere in the app without authentication.
 */
export function useFeatureFlagsQuery() {
  const trpc = useTRPC();

  const { data, isLoading, error } = useQuery(
    trpc.featureFlags.getFeatureFlags.queryOptions()
  );

  return {
    flags: data ?? { groceryTrackingEnabled: true },
    isLoading,
    error,
  };
}
```

**Step 2: Create the context provider**

Create `context/feature-flags-context.tsx`:

```typescript
"use client";

import { createContext, useContext, type ReactNode } from "react";

import { useFeatureFlagsQuery, type FeatureFlags } from "@/hooks/use-feature-flags";

interface FeatureFlagsContextValue extends FeatureFlags {
  isLoading: boolean;
}

const FeatureFlagsContext = createContext<FeatureFlagsContextValue | null>(null);

export function FeatureFlagsProvider({ children }: { children: ReactNode }) {
  const { flags, isLoading } = useFeatureFlagsQuery();

  const value: FeatureFlagsContextValue = {
    ...flags,
    isLoading,
  };

  return (
    <FeatureFlagsContext.Provider value={value}>
      {children}
    </FeatureFlagsContext.Provider>
  );
}

export function useFeatureFlags() {
  const context = useContext(FeatureFlagsContext);

  if (!context) {
    throw new Error("useFeatureFlags must be used within FeatureFlagsProvider");
  }

  return context;
}
```

**Step 3: Commit**

```bash
git add hooks/use-feature-flags.ts context/feature-flags-context.tsx
git commit -m "feat(context): add feature flags hook and provider"
```

---

## Task 4: Add Feature Flags Provider to App Layout

**Files:**
- Modify: `app/(app)/layout.tsx`

**Step 1: Import and wrap with provider**

Update `app/(app)/layout.tsx`:

```typescript
import { AuthProviders } from "../providers/auth-providers";

import { Navbar } from "@/components/navbar/navbar";
import { UserProvider } from "@/context/user-context";
import { HouseholdProvider } from "@/context/household-context";
import { RecipesFiltersProvider } from "@/context/recipes-filters-context";
import { RecipesContextProvider } from "@/context/recipes-context";
import { PermissionsProvider } from "@/context/permissions-context";
import { ArchiveImportProvider } from "@/context/archive-import-context";
import { FeatureFlagsProvider } from "@/context/feature-flags-context"; // ADD

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProviders>
      <FeatureFlagsProvider> {/* ADD */}
        <ArchiveImportProvider>
          <UserProvider>
            <HouseholdProvider>
              <PermissionsProvider>
                <RecipesFiltersProvider>
                  <RecipesContextProvider>
                    <div
                      data-app-container
                      className="relative flex min-h-dvh flex-col overflow-x-hidden"
                    >
                      <Navbar />
                      <main className="container mx-auto flex max-w-7xl flex-1 flex-col px-6 pt-10 pb-20 md:pb-6">
                        {children}
                      </main>
                    </div>
                  </RecipesContextProvider>
                </RecipesFiltersProvider>
              </PermissionsProvider>
            </HouseholdProvider>
          </UserProvider>
        </ArchiveImportProvider>
      </FeatureFlagsProvider> {/* ADD */}
    </AuthProviders>
  );
}
```

**Step 2: Commit**

```bash
git add app/\(app\)/layout.tsx
git commit -m "feat(layout): add FeatureFlagsProvider to app layout"
```

---

## Task 5: Add Admin Mutation for Grocery Tracking

**Files:**
- Create: `server/trpc/routers/admin/grocery-tracking.ts`
- Modify: `server/trpc/routers/admin/index.ts`
- Modify: `hooks/admin/use-admin-mutations.ts`

**Step 1: Create the grocery tracking procedures**

Create `server/trpc/routers/admin/grocery-tracking.ts`:

```typescript
import { z } from "zod";

import { router } from "../../trpc";
import { adminProcedure } from "../../middleware";

import { trpcLogger as log } from "@/server/logger";
import { setConfig } from "@/server/db/repositories/server-config";
import { ServerConfigKeys } from "@/server/db/zodSchemas/server-config";

/**
 * Update grocery tracking enabled setting.
 */
const updateGroceryTracking = adminProcedure
  .input(z.boolean())
  .mutation(async ({ input, ctx }) => {
    log.info({ userId: ctx.user.id, enabled: input }, "Updating grocery tracking setting");

    await setConfig(ServerConfigKeys.GROCERY_TRACKING_ENABLED, input, ctx.user.id, false);

    return { success: true };
  });

export const groceryTrackingProcedures = router({
  updateGroceryTracking,
});
```

**Step 2: Add to admin router**

In `server/trpc/routers/admin/index.ts`, add:

```typescript
import { groceryTrackingProcedures } from "./grocery-tracking";

export const adminRouter = router({
  // ... existing procedures ...
  ...groceryTrackingProcedures._def.procedures,
});
```

**Step 3: Add mutation to hooks**

In `hooks/admin/use-admin-mutations.ts`, add to the type:

```typescript
export type AdminMutationsResult = {
  // ... existing ...
  updateGroceryTracking: (enabled: boolean) => Promise<{ success: boolean }>;
};
```

Add the mutation setup:

```typescript
const updateGroceryTrackingMutation = useMutation(
  trpc.admin.updateGroceryTracking.mutationOptions()
);
```

Add to return object:

```typescript
updateGroceryTracking: async (enabled) => {
  return withInvalidate(updateGroceryTrackingMutation.mutateAsync(enabled));
},
```

**Step 4: Commit**

```bash
git add server/trpc/routers/admin/grocery-tracking.ts server/trpc/routers/admin/index.ts hooks/admin/use-admin-mutations.ts
git commit -m "feat(admin): add grocery tracking mutation"
```

---

## Task 6: Update Admin Settings Context

**Files:**
- Modify: `app/(app)/settings/admin/context.tsx`

**Step 1: Add grocery tracking to context**

In `app/(app)/settings/admin/context.tsx`:

Add to interface:
```typescript
interface AdminSettingsContextValue {
  // Data
  // ... existing ...
  groceryTrackingEnabled: boolean | undefined;

  // Actions
  // ... existing ...
  updateGroceryTracking: (enabled: boolean) => Promise<{ success: boolean }>;
}
```

Add extraction:
```typescript
const groceryTrackingEnabled = configs[ServerConfigKeys.GROCERY_TRACKING_ENABLED] as
  | boolean
  | undefined;
```

Add action wrapper:
```typescript
const updateGroceryTrackingAction = useCallback(
  async (enabled: boolean) => {
    return mutations.updateGroceryTracking(enabled);
  },
  [mutations]
);
```

Add to value object:
```typescript
const value: AdminSettingsContextValue = {
  // ... existing ...
  groceryTrackingEnabled,
  updateGroceryTracking: updateGroceryTrackingAction,
};
```

**Step 2: Commit**

```bash
git add app/\(app\)/settings/admin/context.tsx
git commit -m "feat(admin): add grocery tracking to admin settings context"
```

---

## Task 7: Create Grocery Tracking Admin Card

**Files:**
- Create: `app/(app)/settings/admin/components/grocery-tracking-card.tsx`
- Modify: `app/(app)/settings/admin/components/admin-settings-content.tsx`

**Step 1: Create the card component**

Create `app/(app)/settings/admin/components/grocery-tracking-card.tsx`:

```typescript
"use client";

import { Card, CardBody, CardHeader, Switch } from "@heroui/react";
import { ShoppingBagIcon } from "@heroicons/react/16/solid";

import { useAdminSettingsContext } from "../context";

export default function GroceryTrackingCard() {
  const { groceryTrackingEnabled, updateGroceryTracking, isLoading } = useAdminSettingsContext();

  const handleToggle = async (checked: boolean) => {
    await updateGroceryTracking(checked);
  };

  return (
    <Card>
      <CardHeader>
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <ShoppingBagIcon className="h-5 w-5" />
          Grocery Tracking
        </h2>
      </CardHeader>
      <CardBody>
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <span className="font-medium">Enable local grocery list</span>
            <span className="text-default-500 text-base">
              When disabled, the grocery list page is hidden. Users can still send ingredients to
              external integrations like KitchenOwl.
            </span>
          </div>
          <Switch
            color="success"
            isDisabled={isLoading}
            isSelected={groceryTrackingEnabled ?? true}
            onValueChange={handleToggle}
          />
        </div>
      </CardBody>
    </Card>
  );
}
```

**Step 2: Add to admin settings content**

In `app/(app)/settings/admin/components/admin-settings-content.tsx`:

```typescript
import GroceryTrackingCard from "./grocery-tracking-card";

// In the return, add after RegistrationCard:
<RegistrationCard />
<GroceryTrackingCard /> {/* ADD */}
<PermissionPolicyCard />
```

**Step 3: Commit**

```bash
git add app/\(app\)/settings/admin/components/grocery-tracking-card.tsx app/\(app\)/settings/admin/components/admin-settings-content.tsx
git commit -m "feat(admin): add grocery tracking settings card"
```

---

## Task 8: Update Navbar to Hide Groceries Link

**Files:**
- Modify: `config/site.ts`
- Modify: `components/navbar/navbar.tsx`
- Modify: `components/navbar/mobile-nav.tsx`

**Step 1: Add key to nav items for filtering**

In `config/site.ts`, update navItems:

```typescript
export const siteConfig = {
  name: "Norish",
  description: "Nourish every meal.",
  navItems: [
    {
      key: "home",
      label: "Home",
      href: "/",
    },
    {
      key: "groceries",
      label: "Groceries",
      href: "/groceries",
    },
    {
      key: "calendar",
      label: "Calendar",
      href: "/calendar",
    },
  ],
  // ... rest
};
```

**Step 2: Update desktop navbar**

In `components/navbar/navbar.tsx`:

```typescript
import { useFeatureFlags } from "@/context/feature-flags-context";

export const Navbar = () => {
  const pathname = usePathname();
  const { isVisible, onHoverStart, onHoverEnd } = useAutoHide();
  const { groceryTrackingEnabled } = useFeatureFlags();

  // Filter nav items based on feature flags
  const visibleNavItems = siteConfig.navItems.filter((item) => {
    if (item.key === "groceries" && !groceryTrackingEnabled) {
      return false;
    }
    return true;
  });

  // ... rest of component, replace siteConfig.navItems.map with visibleNavItems.map
```

**Step 3: Update mobile navbar**

In `components/navbar/mobile-nav.tsx`:

```typescript
import { useFeatureFlags } from "@/context/feature-flags-context";

export const MobileNav = () => {
  // ... existing hooks
  const { groceryTrackingEnabled } = useFeatureFlags();

  // Filter nav items based on feature flags
  const visibleNavItems = useMemo(() => {
    return siteConfig.navItems.filter((item) => {
      if (item.key === "groceries" && !groceryTrackingEnabled) {
        return false;
      }
      return true;
    });
  }, [groceryTrackingEnabled]);

  // ... replace siteConfig.navItems.map with visibleNavItems.map in the render
```

**Step 4: Commit**

```bash
git add config/site.ts components/navbar/navbar.tsx components/navbar/mobile-nav.tsx
git commit -m "feat(nav): hide groceries link when grocery tracking disabled"
```

---

## Task 9: Redirect Groceries Page When Disabled

**Files:**
- Modify: `app/(app)/groceries/page.tsx`

**Step 1: Add redirect logic**

Update `app/(app)/groceries/page.tsx`:

```typescript
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import AddGroceryButton from "./components/add-grocery-button";
import GroceriesList from "./components/groceries-list";
import { GroceriesContextProvider } from "./context";

import { useFeatureFlags } from "@/context/feature-flags-context";

export default function GroceriesPage() {
  const router = useRouter();
  const { groceryTrackingEnabled, isLoading } = useFeatureFlags();

  useEffect(() => {
    if (!isLoading && !groceryTrackingEnabled) {
      router.replace("/");
    }
  }, [groceryTrackingEnabled, isLoading, router]);

  // Show nothing while loading or redirecting
  if (isLoading || !groceryTrackingEnabled) {
    return null;
  }

  return (
    <GroceriesContextProvider>
      <div className="space-y-4 pb-16 md:p-6 md:pb-0">
        <h1 className="text-2xl font-bold">Groceries</h1>
        <GroceriesList />
        <AddGroceryButton />
      </div>
    </GroceriesContextProvider>
  );
}
```

**Step 2: Commit**

```bash
git add app/\(app\)/groceries/page.tsx
git commit -m "feat(groceries): redirect to home when grocery tracking disabled"
```

---

## Task 10: Update MiniGroceries Panel

**Files:**
- Modify: `components/Panel/consumers/mini-groceries.tsx`

**Step 1: Conditionally hide local groceries button**

In `components/Panel/consumers/mini-groceries.tsx`:

Add import:
```typescript
import { useFeatureFlags } from "@/context/feature-flags-context";
```

In `MiniGroceriesContent`, add:
```typescript
const { groceryTrackingEnabled } = useFeatureFlags();
```

Update the button section:
```typescript
{localIngredients.length > 0 && (
  <div className="mt-4">
    <Divider className="bg-default-200/40 my-2" />
    <div className="flex flex-col gap-2">
      {groceryTrackingEnabled && (
        <Button
          className="w-full"
          color="primary"
          size="sm"
          onPress={handleAddToGroceries}
        >
          Add to Groceries
        </Button>
      )}
      {showKitchenOwl && (
        <Button
          className="w-full"
          color="secondary"
          isLoading={isKitchenOwlLoading}
          size="sm"
          onPress={handleSendToKitchenOwl}
        >
          Send to KitchenOwl
        </Button>
      )}
    </div>
  </div>
)}
```

**Step 2: Commit**

```bash
git add components/Panel/consumers/mini-groceries.tsx
git commit -m "feat(mini-groceries): hide local groceries button when disabled"
```

---

## Task 11: Update Add to Groceries Button Visibility

**Files:**
- Modify: `app/(app)/recipes/[id]/components/add-to-groceries-button.tsx`

**Step 1: Add visibility check**

Update `app/(app)/recipes/[id]/components/add-to-groceries-button.tsx`:

```typescript
"use client";

import React, { useState, useMemo } from "react";
import { Button } from "@heroui/react";
import { PlusIcon } from "@heroicons/react/16/solid";

import { useRecipeContextRequired } from "../context";

import { MiniGroceries } from "@/components/Panel/consumers";
import { useFeatureFlags } from "@/context/feature-flags-context";
import { useKitchenOwlConfig } from "@/hooks/integrations";

export default function AddToGroceries() {
  const [open, setOpen] = useState(false);
  const { recipe, currentServings } = useRecipeContextRequired();
  const { groceryTrackingEnabled } = useFeatureFlags();
  const { isConfigured, isEnabled } = useKitchenOwlConfig();

  const servingMultiplier = useMemo(() => {
    if (!recipe.servings || recipe.servings === 0) return 1;
    return currentServings / recipe.servings;
  }, [currentServings, recipe.servings]);

  // Hide button if both local groceries and KitchenOwl are disabled
  const showButton = groceryTrackingEnabled || (isConfigured && isEnabled);

  if (!showButton) {
    return null;
  }

  return (
    <>
      <Button
        className="w-full"
        color="primary"
        startContent={<PlusIcon className="h-5 w-5" />}
        onPress={() => setOpen(true)}
      >
        Add to groceries
      </Button>
      <MiniGroceries
        open={open}
        recipeId={recipe.id}
        servingMultiplier={servingMultiplier}
        onOpenChange={setOpen}
      />
    </>
  );
}
```

**Step 2: Commit**

```bash
git add app/\(app\)/recipes/\[id\]/components/add-to-groceries-button.tsx
git commit -m "feat(recipe): hide add to groceries button when both options disabled"
```

---

## Task 12: Update Actions Menu Groceries Option

**Files:**
- Modify: `app/(app)/recipes/[id]/components/actions-menu.tsx`

**Step 1: Add visibility check for groceries menu item**

In `app/(app)/recipes/[id]/components/actions-menu.tsx`:

Add imports:
```typescript
import { useFeatureFlags } from "@/context/feature-flags-context";
import { useKitchenOwlConfig } from "@/hooks/integrations";
```

Add hooks:
```typescript
const { groceryTrackingEnabled } = useFeatureFlags();
const { isConfigured, isEnabled } = useKitchenOwlConfig();
const showGroceriesOption = groceryTrackingEnabled || (isConfigured && isEnabled);
```

Update `menuItems` useMemo to conditionally include groceries:
```typescript
const menuItems = useMemo(() => {
  const items: MenuItem[] = [
    {
      key: "plan",
      label: "Plan",
      icon: <CalendarDaysIcon className="size-4" />,
      onPress: () => setOpenCalendar(true),
    },
  ];

  if (showGroceriesOption) {
    items.push({
      key: "groceries",
      label: "Groceries",
      icon: <ShoppingCartIcon className="size-4" />,
      onPress: () => setOpenGroceries(true),
    });
  }

  // ... rest of items (edit, wake-lock, delete)
}, [canEdit, canDelete, handleDelete, id, router, isSupported, isActive, toggle, showGroceriesOption]);
```

**Step 2: Commit**

```bash
git add app/\(app\)/recipes/\[id\]/components/actions-menu.tsx
git commit -m "feat(recipe): hide groceries menu option when both options disabled"
```

---

## Task 13: Update Recipe Card Swipe Actions

**Files:**
- Modify: `components/dashboard/recipe-card.tsx`

**Step 1: Add visibility check for groceries swipe action**

In `components/dashboard/recipe-card.tsx`:

Add imports:
```typescript
import { useFeatureFlags } from "@/context/feature-flags-context";
import { useKitchenOwlConfig } from "@/hooks/integrations";
```

Add hooks:
```typescript
const { groceryTrackingEnabled } = useFeatureFlags();
const { isConfigured, isEnabled } = useKitchenOwlConfig();
const showGroceriesAction = groceryTrackingEnabled || (isConfigured && isEnabled);
```

Update `actions` useMemo:
```typescript
const actions: SwipeAction[] = useMemo(() => {
  const baseActions: SwipeAction[] = [];

  if (showGroceriesAction) {
    baseActions.push({
      key: "groceries",
      icon: ShoppingBagIcon,
      color: "blue",
      onPress: () => setGroceriesOpen(true),
      label: "View groceries",
    });
  }

  baseActions.push({
    key: "calendar",
    icon: CalendarDaysIcon,
    color: "yellow",
    onPress: () => setCalendarOpen(true),
    label: "Add to calendar",
  });

  if (showDeleteAction) {
    baseActions.push({
      key: "delete",
      icon: TrashIcon,
      color: "danger",
      onPress: deleteRecipeButton,
      primary: true,
      label: "Delete recipe",
    });
  }

  return baseActions;
}, [showDeleteAction, deleteRecipeButton, showGroceriesAction]);
```

**Step 2: Commit**

```bash
git add components/dashboard/recipe-card.tsx
git commit -m "feat(recipe-card): hide groceries swipe action when both options disabled"
```

---

## Task 14: Update Calendar Day Timeline

**Files:**
- Modify: `app/(app)/calendar/components/day-timeline-body.tsx`

**Step 1: Add visibility check for groceries action**

In `app/(app)/calendar/components/day-timeline-body.tsx`:

Add imports:
```typescript
import { useFeatureFlags } from "@/context/feature-flags-context";
import { useKitchenOwlConfig } from "@/hooks/integrations";
```

Add hooks inside the component:
```typescript
const { groceryTrackingEnabled } = useFeatureFlags();
const { isConfigured, isEnabled } = useKitchenOwlConfig();
const showGroceriesAction = groceryTrackingEnabled || (isConfigured && isEnabled);
```

Update `getItemActions` callback:
```typescript
const getItemActions = useCallback(
  (item: CalendarItemViewDto): SwipeAction[] => {
    const hasRecipe = item.itemType === "recipe" || (item.itemType === "note" && item.recipeId);
    const actions: SwipeAction[] = [];

    if (hasRecipe && showGroceriesAction) {
      const recipeId = item.itemType === "recipe" ? item.recipeId : item.recipeId!;

      actions.push({
        key: "groceries",
        icon: ShoppingBagIcon,
        color: "blue",
        onPress: () => openGroceries(recipeId),
        label: "View groceries",
      });
    }

    if (hasRecipe) {
      const recipeId = item.itemType === "recipe" ? item.recipeId : item.recipeId!;

      actions.push({
        key: "recipe",
        icon: DocumentIcon,
        color: "yellow",
        onPress: () => navigateToRecipe(recipeId),
        label: "Go to recipe",
      });
    }

    actions.push({
      key: "delete",
      icon: TrashIcon,
      color: "danger",
      onPress: () => onDelete(item.id, item.itemType),
      primary: true,
      label: "Delete item",
    });

    return actions;
  },
  [openGroceries, navigateToRecipe, onDelete, showGroceriesAction]
);
```

**Step 2: Commit**

```bash
git add app/\(app\)/calendar/components/day-timeline-body.tsx
git commit -m "feat(calendar): hide groceries action when both options disabled"
```

---

## Task 15: Run Tests and Verify

**Step 1: Run the type checker**

```bash
npm run typecheck
```

Expected: No type errors

**Step 2: Run linter**

```bash
npm run lint
```

Expected: No lint errors

**Step 3: Run the dev server**

```bash
npm run dev
```

Expected: App starts without errors

**Step 4: Manual testing checklist**

1. Open Admin Settings, verify Grocery Tracking card appears
2. Toggle grocery tracking off
3. Verify "Groceries" nav link disappears (both desktop and mobile)
4. Navigate directly to /groceries, verify redirect to home
5. Open a recipe, verify "Add to groceries" button is hidden (assuming no KitchenOwl)
6. Configure KitchenOwl, verify button reappears
7. Open MiniGroceries panel, verify only KitchenOwl button shows
8. Toggle grocery tracking back on, verify everything works as before

**Step 5: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: address any issues found during testing"
```

---

## Summary

This implementation adds a toggleable grocery tracking feature with:
- Global admin setting stored in server_config table
- Public feature flags endpoint for unauthenticated access
- FeatureFlagsProvider context for app-wide access
- Conditional navigation, button, and action visibility
- Redirect protection for the groceries page
- Backwards compatible (defaults to enabled)
