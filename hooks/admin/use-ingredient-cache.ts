"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useTRPC } from "@/app/providers/trpc-provider";

export function useIngredientCacheQuery(page: number = 1, search?: string) {
  const trpc = useTRPC();

  const query = useQuery(
    trpc.admin.ingredientCache.list.queryOptions({
      page,
      limit: 20,
      search: search || undefined,
    })
  );

  return query;
}

export function useIngredientCacheMutations() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const invalidate = () => {
    queryClient.invalidateQueries({
      queryKey: trpc.admin.ingredientCache.list.queryKey(),
    });
  };

  const addMutation = useMutation(
    trpc.admin.ingredientCache.add.mutationOptions()
  );
  const updateMutation = useMutation(
    trpc.admin.ingredientCache.update.mutationOptions()
  );
  const deleteMutation = useMutation(
    trpc.admin.ingredientCache.delete.mutationOptions()
  );
  const clearMutation = useMutation(
    trpc.admin.ingredientCache.clear.mutationOptions()
  );

  return {
    add: async (rawName: string, normalizedName: string) => {
      const result = await addMutation.mutateAsync({ rawName, normalizedName });
      invalidate();
      return result;
    },
    update: async (id: string, normalizedName: string) => {
      const result = await updateMutation.mutateAsync({ id, normalizedName });
      invalidate();
      return result;
    },
    remove: async (id: string) => {
      const result = await deleteMutation.mutateAsync({ id });
      invalidate();
      return result;
    },
    clear: async () => {
      const result = await clearMutation.mutateAsync();
      invalidate();
      return result;
    },
    isAdding: addMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
    isClearing: clearMutation.isPending,
  };
}
