# Functional Specification: KitchenOwl Integration for Norish

**Author:** Dan Howell  
**Date:** January 2025  
**Status:** Draft  
**Target Repository:** Fork of https://github.com/norish-recipes/norish

---

## 1. Executive Summary

This specification defines a feature enhancement to Norish that enables users to send recipe ingredients directly to a KitchenOwl shopping list. The goal is to leverage Norish's superior recipe management UI while using KitchenOwl's mature grocery list functionality and native mobile apps.

---

## 2. Problem Statement

### Current State
- **Norish** excels at recipe management: beautiful UI, real-time sync, AI-powered imports, video recipe support
- **KitchenOwl** excels at grocery lists: native iOS/Android apps, offline support, expense tracking, store-section categorisation
- No integration exists between these applications
- Users must manually copy ingredients from Norish recipes to KitchenOwl shopping lists

### Pain Points
1. Manual transcription of ingredients is error-prone and time-consuming
2. Ingredient quantities and units must be re-entered
3. No way to batch-add all ingredients from a recipe
4. Friction reduces likelihood of meal planning adoption

---

## 3. Proposed Solution

Add a "Send to KitchenOwl" feature in Norish that:
1. Allows users to configure their KitchenOwl instance URL and API token
2. Provides a one-click action to send all ingredients from a recipe to a KitchenOwl shopping list
3. Optionally allows selection of specific ingredients before sending

---

## 4. Requirements

### 4.1 Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-1 | User can configure KitchenOwl server URL in Norish settings | Must Have |
| FR-2 | User can configure KitchenOwl API token in Norish settings | Must Have |
| FR-3 | User can select target KitchenOwl household/shopping list | Should Have |
| FR-4 | User can send all ingredients from a recipe to KitchenOwl with one click | Must Have |
| FR-5 | User can select specific ingredients before sending | Should Have |
| FR-6 | System scales ingredient quantities based on current serving size | Should Have |
| FR-7 | User receives confirmation of successful send | Must Have |
| FR-8 | User receives clear error message if send fails | Must Have |
| FR-9 | Configuration is stored securely (API token encrypted) | Must Have |

### 4.2 Non-Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| NFR-1 | API token must be encrypted at rest using existing Norish encryption (MASTER_KEY) | Must Have |
| NFR-2 | KitchenOwl API calls must timeout after 10 seconds | Must Have |
| NFR-3 | Feature must work with KitchenOwl instances behind reverse proxies (Cloudflare Tunnel) | Must Have |
| NFR-4 | Feature must be optional and not affect users who don't configure it | Must Have |

---

## 5. Technical Design

### 5.1 KitchenOwl API Reference

**Source:** https://github.com/TomBursch/kitchenowl-backend

**Authentication:**  
Bearer token obtained from KitchenOwl UI:  
`Profile → Settings → Sessions → Long-lived tokens`

**Key Endpoints:**

```
GET  /api/household
Returns list of households the user belongs to

GET  /api/household/{householdId}/shoppinglist
Returns shopping lists for a household

POST /api/shoppinglist/{listId}/add-item-by-name
Adds an item to shopping list by name
Body: { "name": "ingredient string" }
```

**Example API Call:**
```bash
curl -X POST https://kitchen.example.com/api/shoppinglist/1/add-item-by-name \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"name": "1 lb Ground Beef"}'
```

### 5.2 Norish Architecture Context

**Tech Stack:**
- Frontend: Next.js 16, React, TailwindCSS, HeroUI
- Backend: Node.js, tRPC, Drizzle ORM
- Database: PostgreSQL
- State: TanStack Query, Context API

**Relevant Existing Patterns:**
- Settings stored in database via Drizzle schema
- Admin settings UI pattern in `app/settings/admin/`
- Encrypted secrets pattern used for AI API keys
- tRPC procedures in `server/trpc/`

### 5.3 Proposed Implementation

#### 5.3.1 Database Schema Addition

```typescript
// In relevant schema file
export const integrations = pgTable('integrations', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  type: varchar('type', { length: 50 }).notNull(), // 'kitchenowl'
  serverUrl: varchar('server_url', { length: 500 }),
  encryptedToken: text('encrypted_token'),
  defaultHouseholdId: integer('default_household_id'),
  defaultShoppingListId: integer('default_shopping_list_id'),
  enabled: boolean('enabled').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});
```

#### 5.3.2 New tRPC Procedures

```typescript
// server/trpc/routers/integrations.ts

export const integrationsRouter = router({
  // Get user's KitchenOwl config
  getKitchenOwlConfig: protectedProcedure.query(async ({ ctx }) => {
    // Return decrypted config for current user
  }),

  // Save KitchenOwl config
  saveKitchenOwlConfig: protectedProcedure
    .input(z.object({
      serverUrl: z.string().url(),
      apiToken: z.string(),
      defaultHouseholdId: z.number().optional(),
      defaultShoppingListId: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Encrypt token and save
    }),

  // Test KitchenOwl connection
  testKitchenOwlConnection: protectedProcedure
    .input(z.object({
      serverUrl: z.string().url(),
      apiToken: z.string(),
    }))
    .mutation(async ({ input }) => {
      // Call KitchenOwl API to verify credentials
      // Return list of households/shopping lists
    }),

  // Send ingredients to KitchenOwl
  sendToKitchenOwl: protectedProcedure
    .input(z.object({
      recipeId: z.string().uuid(),
      ingredientIds: z.array(z.string().uuid()).optional(), // If empty, send all
      servingMultiplier: z.number().default(1),
    }))
    .mutation(async ({ ctx, input }) => {
      // Get recipe ingredients
      // Scale quantities by multiplier
      // POST each to KitchenOwl
      // Return success/failure count
    }),
});
```

#### 5.3.3 UI Components

**Settings Page Addition:**
- New section in user settings: "Integrations"
- KitchenOwl configuration form
- Test connection button
- Dropdown to select default household/list

**Recipe View Addition:**
- New button/menu item: "Add to KitchenOwl"
- Optional ingredient selection modal
- Success/error toast notifications

### 5.4 File Locations (Estimated)

```
norish/
├── lib/
│   └── integrations/
│       └── kitchenowl.ts          # KitchenOwl API client
├── server/
│   └── trpc/
│       └── routers/
│           └── integrations.ts     # tRPC procedures
├── app/
│   └── settings/
│       └── integrations/
│           └── page.tsx            # Settings UI
├── components/
│   └── recipe/
│       └── SendToKitchenOwl.tsx    # Recipe action component
└── lib/
    └── db/
        └── schema/
            └── integrations.ts     # Database schema
```

---

## 6. User Stories

### US-1: Configure KitchenOwl Integration
**As a** Norish user  
**I want to** connect my KitchenOwl instance to Norish  
**So that** I can send ingredients to my shopping list  

**Acceptance Criteria:**
- [ ] Settings page has "Integrations" section
- [ ] I can enter my KitchenOwl URL
- [ ] I can enter my KitchenOwl API token
- [ ] I can test the connection and see success/failure
- [ ] I can select my default household and shopping list
- [ ] Configuration persists across sessions

### US-2: Send All Ingredients to Shopping List
**As a** Norish user viewing a recipe  
**I want to** send all ingredients to KitchenOwl with one click  
**So that** I don't have to manually add each ingredient  

**Acceptance Criteria:**
- [ ] Recipe view has "Add to KitchenOwl" button (only visible if configured)
- [ ] Clicking sends all ingredients to configured shopping list
- [ ] I see a success message with count of items added
- [ ] Items appear in KitchenOwl immediately

### US-3: Send Selected Ingredients
**As a** Norish user  
**I want to** choose which ingredients to send  
**So that** I can skip items I already have  

**Acceptance Criteria:**
- [ ] I can open an ingredient selection modal
- [ ] All ingredients are checked by default
- [ ] I can uncheck ingredients I don't need
- [ ] Only selected ingredients are sent

---

## 7. Validation & Testing

### 7.1 Manual Validation Steps

#### Test Case 1: Configuration
1. Navigate to Settings → Integrations
2. Enter KitchenOwl URL: `https://kitchen.codingdan.com`
3. Enter API token from KitchenOwl
4. Click "Test Connection"
5. **Expected:** Success message, household/list dropdowns populate
6. Select default household and shopping list
7. Click Save
8. Refresh page
9. **Expected:** Configuration persists

#### Test Case 2: Send All Ingredients
1. Open a recipe with 5+ ingredients
2. Click "Add to KitchenOwl"
3. **Expected:** Loading indicator appears
4. **Expected:** Success toast: "Added X items to shopping list"
5. Open KitchenOwl app
6. **Expected:** All ingredients appear in shopping list

#### Test Case 3: Send Selected Ingredients
1. Open a recipe with 5+ ingredients
2. Click dropdown arrow on "Add to KitchenOwl"
3. Click "Select ingredients..."
4. Uncheck 2 ingredients
5. Click "Add Selected"
6. **Expected:** Only 3 items added to KitchenOwl

#### Test Case 4: Error Handling
1. Configure with invalid API token
2. Attempt to send ingredients
3. **Expected:** Clear error message about authentication failure
4. Configure with unreachable URL
5. Attempt to send ingredients
6. **Expected:** Clear error message about connection failure

#### Test Case 5: Serving Size Scaling
1. Open a recipe set to 4 servings
2. Change to 8 servings
3. Send ingredients to KitchenOwl
4. **Expected:** Quantities doubled in KitchenOwl (e.g., "2 lb Ground Beef" instead of "1 lb")

### 7.2 Automated Tests

```typescript
// __tests__/integrations/kitchenowl.test.ts

describe('KitchenOwl Integration', () => {
  it('encrypts API token before storing', async () => {
    // ...
  });

  it('formats ingredients correctly for KitchenOwl API', async () => {
    // ...
  });

  it('scales quantities based on serving multiplier', async () => {
    // ...
  });

  it('handles KitchenOwl API errors gracefully', async () => {
    // ...
  });
});
```

---

## 8. Fork & Development Setup

### 8.1 Forking the Repository

```bash
# 1. Fork on GitHub
# Go to https://github.com/norish-recipes/norish
# Click "Fork" button
# This creates https://github.com/YOUR_USERNAME/norish

# 2. Clone your fork locally
git clone https://github.com/YOUR_USERNAME/norish.git
cd norish

# 3. Add upstream remote (official repo)
git remote add upstream https://github.com/norish-recipes/norish.git

# 4. Verify remotes
git remote -v
# origin    https://github.com/YOUR_USERNAME/norish.git (fetch)
# origin    https://github.com/YOUR_USERNAME/norish.git (push)
# upstream  https://github.com/norish-recipes/norish.git (fetch)
# upstream  https://github.com/norish-recipes/norish.git (push)
```

### 8.2 Development Workflow

```bash
# Create feature branch
git checkout -b feature/kitchenowl-integration

# Make changes, commit regularly
git add .
git commit -m "feat: add KitchenOwl integration settings UI"

# Push to your fork
git push origin feature/kitchenowl-integration
```

### 8.3 Building Your Custom Docker Image

```bash
# In your forked repo directory
docker build -t your-dockerhub-username/norish:kitchenowl .

# Or for local use only (no push)
docker build -t norish-custom:latest .
```

### 8.4 Switching Your Pi from Official to Your Fork

**On your Raspberry Pi:**

```bash
cd ~/apps/norish

# Edit docker-compose.yml
nano docker-compose.yml
```

**Change the image line:**

```yaml
services:
  norish:
    # FROM:
    # image: norishapp/norish:latest
    
    # TO (if pushed to Docker Hub):
    image: your-dockerhub-username/norish:kitchenowl
    
    # OR (if building locally on Pi - slower):
    build:
      context: /home/dan/norish-fork
      dockerfile: Dockerfile
```

**Apply the change:**

```bash
docker compose down
docker compose pull   # If using Docker Hub image
docker compose up -d
```

### 8.5 Keeping Your Fork Updated with Official

```bash
# Fetch latest from official repo
git fetch upstream

# Switch to your main branch
git checkout main

# Merge official changes into your main
git merge upstream/main

# Push updated main to your fork
git push origin main

# Rebase your feature branch onto updated main
git checkout feature/kitchenowl-integration
git rebase main

# If conflicts, resolve them, then:
git rebase --continue
```

**After major upstream updates, rebuild and redeploy:**

```bash
# On your development machine
docker build -t your-dockerhub-username/norish:kitchenowl .
docker push your-dockerhub-username/norish:kitchenowl

# On your Pi
cd ~/apps/norish
docker compose pull
docker compose up -d
```

### 8.6 Contributing Back to Official

If the feature works well, consider contributing it upstream:

1. Ensure code follows project conventions
2. Add/update tests
3. Update documentation
4. Open a Pull Request from your fork to `norish-recipes/norish`
5. Reference this spec in the PR description

---

## 9. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| KitchenOwl API changes | Low | Medium | Pin to known working version, add API version check |
| Token storage security | Medium | High | Use existing Norish encryption pattern with MASTER_KEY |
| Rate limiting by KitchenOwl | Low | Low | Add small delay between API calls if sending many items |
| Norish upstream changes break fork | Medium | Medium | Regular rebasing, modular code design |

---

## 10. Future Enhancements (Out of Scope)

- Bidirectional sync (KitchenOwl → Norish)
- Automatic ingredient categorisation based on KitchenOwl categories
- Meal plan sync between apps
- Support for other shopping list apps (Todoist, AnyList, etc.)

---

## 11. References

- Norish Repository: https://github.com/norish-recipes/norish
- KitchenOwl Repository: https://github.com/TomBursch/kitchenowl
- KitchenOwl Backend (API): https://github.com/TomBursch/kitchenowl-backend
- KitchenOwl API Discussion: https://github.com/TomBursch/kitchenowl/discussions/200
- tRPC Documentation: https://trpc.io/docs
- Drizzle ORM Documentation: https://orm.drizzle.team/docs/overview

---

## 12. Appendix: KitchenOwl API Token Generation

1. Log into KitchenOwl web interface
2. Click your profile icon (top right)
3. Go to Settings
4. Click on your profile at the top
5. Navigate to "Sessions" tab
6. Click "Create Long-lived Token"
7. Name it (e.g., "Norish Integration")
8. Copy the generated token immediately (it won't be shown again)
