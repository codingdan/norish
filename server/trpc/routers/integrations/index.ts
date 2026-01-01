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
  // Accepts optional serverUrl/apiToken for initial setup before config is saved
  getShoppingLists: authedProcedure
    .input(
      z.object({
        householdId: z.number(),
        serverUrl: z.string().url().optional(),
        apiToken: z.string().min(1).optional(),
      })
    )
    .query(async ({ ctx, input }): Promise<KitchenOwlShoppingList[]> => {
      // Use provided credentials (initial setup) or fall back to saved config
      let serverUrl = input.serverUrl;
      let apiToken = input.apiToken;

      if (!serverUrl || !apiToken) {
        const config = await getKitchenOwlConfig(ctx.user.id);
        if (!config) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "KitchenOwl not configured",
          });
        }
        serverUrl = config.serverUrl;
        apiToken = config.apiToken;
      }

      return getShoppingLists(serverUrl, apiToken, input.householdId);
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
        ingredients = ingredients.filter(
          (ing) => ing.ingredientId !== null && idSet.has(ing.ingredientId)
        );
      }

      // Format ingredients with scaled amounts
      const items = ingredients.map((ing) => {
        const scaledAmount =
          ing.amount !== null ? ing.amount * input.servingMultiplier : null;
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
