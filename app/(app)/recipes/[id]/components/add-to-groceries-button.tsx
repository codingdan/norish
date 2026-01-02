"use client";

import React, { useState, useMemo } from "react";
import { Button } from "@heroui/react";
import { PlusIcon } from "@heroicons/react/16/solid";

import { useRecipeContextRequired } from "../context";

import { MiniGroceries } from "@/components/Panel/consumers";

export default function AddToGroceries() {
  const [open, setOpen] = useState(false);
  const { recipe, currentServings } = useRecipeContextRequired();

  const servingMultiplier = useMemo(() => {
    if (!recipe.servings || recipe.servings === 0) return 1;
    return currentServings / recipe.servings;
  }, [currentServings, recipe.servings]);

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
