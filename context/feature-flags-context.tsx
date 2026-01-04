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

  return <FeatureFlagsContext.Provider value={value}>{children}</FeatureFlagsContext.Provider>;
}

export function useFeatureFlags() {
  const context = useContext(FeatureFlagsContext);

  if (!context) {
    throw new Error("useFeatureFlags must be used within FeatureFlagsProvider");
  }

  return context;
}
