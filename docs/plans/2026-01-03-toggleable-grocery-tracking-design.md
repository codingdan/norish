# Toggleable Grocery Tracking Design

## Overview

Make the built-in grocery list feature toggleable via admin settings. When disabled, the grocery list page is hidden but users can still send ingredients to external integrations like KitchenOwl.

## Requirements

1. **Admin Setting**: Global toggle in Admin Settings for grocery tracking (enabled by default)
2. **Navigation**: Remove "Groceries" link from navbar when disabled
3. **Direct URL Access**: Redirect `/groceries` to home when disabled
4. **MiniGroceries Panel**:
   - When local disabled + KitchenOwl configured: Panel shows, only KitchenOwl button visible
   - When local disabled + KitchenOwl NOT configured: "Add to Groceries" button hidden entirely
   - When local enabled: Current behavior (both buttons if KitchenOwl configured)
5. **Button Label**: Stays "Add to Groceries" regardless of which options are available inside

## Data Model

### Server Config Addition

Add `groceryTrackingEnabled: boolean` to server config table with default `true`.

### Public Feature Flags Endpoint

New tRPC query `getAppFeatures` returning only feature flags (no sensitive admin config):
```typescript
{
  groceryTrackingEnabled: boolean
}
```

## Implementation

### Files to Create

| File | Purpose |
|------|---------|
| `hooks/use-feature-flags.ts` | Hook for accessing feature flags |
| `app/(app)/providers/feature-flags-provider.tsx` | Context provider |
| Migration file | Add groceryTrackingEnabled column |

### Files to Modify

#### Server/DB
- `server/db/schema/` - add groceryTrackingEnabled to server config
- `server/trpc/routers/` - add public getAppFeatures endpoint
- `server/db/repositories/` - update config repository

#### Admin UI
- `admin-settings-content.tsx` - add new Features/Grocery Tracking card
- `context.tsx` - add mutation for updating the setting

#### Navigation
- `navbar.tsx` - conditional grocery link based on feature flag
- `app/(app)/groceries/page.tsx` - redirect to home when disabled

#### Recipe/Calendar Components
- `add-to-groceries-button.tsx` - visibility check
- `actions-menu.tsx` - "Groceries" menu item visibility
- `mini-groceries.tsx` - conditional button rendering
- `recipe-card.tsx` - swipeable action visibility
- `day-timeline-body.tsx` - calendar add to groceries visibility

## Button Visibility Logic

### "Add to Groceries" Button (triggers panel)
```
showButton = groceryTrackingEnabled || kitchenOwlConfigured
```

### Inside MiniGroceries Panel
- "Add to Groceries" button: `groceryTrackingEnabled === true`
- "Send to KitchenOwl" button: KitchenOwl configured (existing logic)

## Feature Flags Context

Create a lightweight context available at the app layout level:

```typescript
const FeatureFlagsContext = createContext<{
  groceryTrackingEnabled: boolean
  isLoading: boolean
}>()

export function useFeatureFlags() {
  return useContext(FeatureFlagsContext)
}
```

This fetches from the public `getAppFeatures` endpoint (no admin auth required).

## Admin UI Design

Add a card in Admin Settings:

**Grocery Tracking**
- Toggle: "Enable local grocery list"
- Helper text: "When disabled, the grocery list page is hidden. Users can still send ingredients to external integrations like KitchenOwl."

## Edge Cases

1. **Setting disabled while user on /groceries**: Page redirects to home
2. **Both local and KitchenOwl disabled**: "Add to Groceries" button hidden entirely
3. **Existing grocery data when disabled**: Data preserved, just UI hidden
