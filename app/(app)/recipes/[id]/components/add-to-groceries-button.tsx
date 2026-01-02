"use client";

import React, { useState, useMemo } from "react";
import { Button } from "@heroui/react";
import { PlusIcon } from "@heroicons/react/16/solid";

import { useRecipeContextRequired } from "../context";

import { MiniGroceries } from "@/components/Panel/consumers";
import { useFeatureFlags } from "@/context/feature-flags-context";
import { useKitchenOwlConfig } from "@/hooks/integrations";

export default function AddToGroceries() {
  const [open, setOpen] = useState(false);
  const { recipe, currentServings } = useRecipeContextRequired();
  const { groceryTrackingEnabled } = useFeatureFlags();
  const { isConfigured, isEnabled } = useKitchenOwlConfig();

  const servingMultiplier = useMemo(() => {
    if (!recipe.servings || recipe.servings === 0) return 1;
    return currentServings / recipe.servings;
  }, [currentServings, recipe.servings]);

  // Hide button if both local groceries and KitchenOwl are disabled
  const showButton = groceryTrackingEnabled || (isConfigured && isEnabled);

  if (!showButton) {
    return null;
  }

  return (
    <>
      <Button
        className="w-full"
        color="primary"
        startContent={<PlusIcon className="h-5 w-5" />}
        onPress={() => setOpen(true)}
      >
        Add to groceries
      </Button>
      <MiniGroceries
        open={open}
        recipeId={recipe.id}
        servingMultiplier={servingMultiplier}
        onOpenChange={setOpen}
      />
    </>
  );
}
