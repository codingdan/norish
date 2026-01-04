"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { useTRPC } from "@/app/providers/trpc-provider";

const PAGE_LIMIT = 20;

export function useIngredientCache(page: number = 1, search?: string) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery(
    trpc.admin.ingredientCache.list.queryOptions({ page, limit: PAGE_LIMIT, search })
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
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
    isClearing: clearMutation.isPending,
  };
}
