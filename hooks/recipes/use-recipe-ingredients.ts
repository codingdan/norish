"use client";

import type { RecipeIngredientsDto } from "@/types";

import { useMemo } from "react";

import { useRecipeQuery } from "@/hooks/recipes/use-recipe-query";

/**
 * Hook to fetch recipe ingredients using the tRPC recipes.get query.
 * This is a convenience wrapper for components that only need ingredients.
 *
 * Filters ingredients to only return those matching the recipe's measurement system.
 * AI imports store both metric and US versions - this ensures we only show one system.
 */
export function useRecipeIngredients(id: string | null) {
  const { recipe, isLoading, error } = useRecipeQuery(id);

  const ingredients = useMemo(() => {
    if (!recipe?.recipeIngredients) return [];

    // Filter to only show ingredients matching the recipe's measurement system
    // AI imports store both metric and US versions - we only want to show one system
    return recipe.recipeIngredients.filter(
      (ing) => ing.systemUsed === recipe.systemUsed
    ) as RecipeIngredientsDto[];
  }, [recipe?.recipeIngredients, recipe?.systemUsed]);

  return {
    ingredients,
    isLoading,
    error,
  };
}
