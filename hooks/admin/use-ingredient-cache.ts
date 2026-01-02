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
