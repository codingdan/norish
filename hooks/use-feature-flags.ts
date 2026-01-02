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
