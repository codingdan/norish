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
