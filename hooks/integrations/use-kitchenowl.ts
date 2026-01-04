"use client";

import type { QueryKey } from "@tanstack/react-query";

import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
import { useCallback } from "react";

import { useTRPC } from "@/app/providers/trpc-provider";

/**
 * Query hook for KitchenOwl configuration.
 * Returns configuration status and provides cache invalidation.
 */
export function useKitchenOwlConfig() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const queryKey = trpc.integrations.getKitchenOwlConfig.queryKey();

  const { data, isLoading } = useQuery(
    trpc.integrations.getKitchenOwlConfig.queryOptions()
  );

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey });
  }, [queryClient, queryKey]);

  // Normalize the config data to handle undefined -> null
  const config = data
    ? {
        serverUrl: data.serverUrl,
        apiTokenMasked: data.apiTokenMasked,
        defaultHouseholdId: data.defaultHouseholdId ?? null,
        defaultShoppingListId: data.defaultShoppingListId ?? null,
        enabled: data.enabled,
      }
    : null;

  return {
    config,
    isLoading,
    isConfigured: !!data?.serverUrl,
    isEnabled: data?.enabled ?? false,
    queryKey,
    invalidate,
  };
}

/**
 * Mutations hook for KitchenOwl configuration operations.
 * Provides save, delete, and test connection mutations.
 */
export function useKitchenOwlMutations() {
  const trpc = useTRPC();
  const { invalidate } = useKitchenOwlConfig();

  const saveConfig = useMutation({
    ...trpc.integrations.saveKitchenOwlConfig.mutationOptions(),
    onSuccess: () => {
      invalidate();
    },
  });

  const deleteConfig = useMutation({
    ...trpc.integrations.deleteKitchenOwlConfig.mutationOptions(),
    onSuccess: () => {
      invalidate();
    },
  });

  const testConnection = useMutation(
    trpc.integrations.testKitchenOwlConnection.mutationOptions()
  );

  return {
    saveConfig,
    deleteConfig,
    testConnection,
  };
}

/**
 * Options for sending ingredients to KitchenOwl
 */
export interface SendIngredientsOptions {
  ingredientIds?: string[];
  servingMultiplier?: number;
  shoppingListId?: number;
}

/**
 * Mutation hook for sending recipe ingredients to KitchenOwl.
 * Provides a convenient sendIngredients function with scaling support.
 */
export function useSendToKitchenOwl() {
  const trpc = useTRPC();

  const mutation = useMutation(
    trpc.integrations.sendToKitchenOwl.mutationOptions()
  );

  const sendIngredients = useCallback(
    async (recipeId: string, options?: SendIngredientsOptions) => {
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
