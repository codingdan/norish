"use client";

import { useState, useMemo } from "react";
import {
  Button,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Checkbox,
  CheckboxGroup,
  useDisclosure,
  addToast,
} from "@heroui/react";
import { ShoppingCartIcon, ChevronDownIcon, CheckIcon } from "@heroicons/react/20/solid";

import { useRecipeContextRequired } from "../context";

import { useKitchenOwlConfig, useSendToKitchenOwl } from "@/hooks/integrations";
import type { RecipeIngredientsDto } from "@/types";

export default function SendToKitchenOwlButton() {
  const { config, isConfigured, isEnabled } = useKitchenOwlConfig();
  const { sendIngredients, isLoading } = useSendToKitchenOwl();
  const { recipe, adjustedIngredients, currentServings } = useRecipeContextRequired();
  const selectModal = useDisclosure();

  // Filter ingredients for the current measurement system
  const currentIngredients = useMemo(() => {
    return adjustedIngredients
      .filter((it) => it.systemUsed === recipe.systemUsed)
      .sort((a, b) => a.order - b.order);
  }, [adjustedIngredients, recipe.systemUsed]);

  // Get only selectable ingredients (not headers, and with valid ingredientId)
  const selectableIngredients = useMemo(() => {
    return currentIngredients.filter(
      (it) => !it.ingredientName.trim().startsWith("#") && it.ingredientId !== null
    );
  }, [currentIngredients]);

  // Track selected ingredient IDs for the modal
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Initialize selected IDs when modal opens
  const handleOpenSelectModal = () => {
    setSelectedIds(
      selectableIngredients
        .map((it) => it.ingredientId)
        .filter((id): id is string => id !== null)
    );
    selectModal.onOpen();
  };

  // Calculate serving multiplier
  const servingMultiplier = useMemo(() => {
    if (!recipe.servings || recipe.servings === 0) return 1;
    return currentServings / recipe.servings;
  }, [currentServings, recipe.servings]);

  // Handle sending all ingredients
  const handleSendAll = async () => {
    try {
      const result = await sendIngredients(recipe.id, {
        servingMultiplier,
      });

      addToast({
        title: "Added to KitchenOwl",
        description: `${result.successCount} ingredient${result.successCount !== 1 ? "s" : ""} added to shopping list`,
        color: "success",
      });
    } catch (error) {
      addToast({
        title: "Failed to add",
        description: error instanceof Error ? error.message : "Could not add ingredients to KitchenOwl",
        color: "danger",
      });
    }
  };

  // Handle sending selected ingredients
  const handleSendSelected = async () => {
    if (selectedIds.length === 0) {
      addToast({
        title: "No ingredients selected",
        description: "Please select at least one ingredient",
        color: "warning",
      });
      return;
    }

    try {
      const result = await sendIngredients(recipe.id, {
        ingredientIds: selectedIds,
        servingMultiplier,
      });

      addToast({
        title: "Added to KitchenOwl",
        description: `${result.successCount} ingredient${result.successCount !== 1 ? "s" : ""} added to shopping list`,
        color: "success",
      });

      selectModal.onClose();
    } catch (error) {
      addToast({
        title: "Failed to add",
        description: error instanceof Error ? error.message : "Could not add ingredients to KitchenOwl",
        color: "danger",
      });
    }
  };

  // Only render if KitchenOwl is configured and enabled
  if (!isConfigured || !isEnabled) {
    return null;
  }

  return (
    <>
      <Dropdown>
        <DropdownTrigger>
          <Button
            className="w-full"
            color="secondary"
            endContent={<ChevronDownIcon className="h-4 w-4" />}
            isLoading={isLoading}
            startContent={<ShoppingCartIcon className="h-5 w-5" />}
          >
            Add to KitchenOwl
          </Button>
        </DropdownTrigger>

        <DropdownMenu aria-label="KitchenOwl options">
          <DropdownItem
            key="add-all"
            description="Send all ingredients to your shopping list"
            startContent={<CheckIcon className="h-4 w-4" />}
            onPress={handleSendAll}
          >
            Add all ingredients
          </DropdownItem>
          <DropdownItem
            key="select"
            description="Choose which ingredients to add"
            startContent={<ShoppingCartIcon className="h-4 w-4" />}
            onPress={handleOpenSelectModal}
          >
            Select ingredients...
          </DropdownItem>
        </DropdownMenu>
      </Dropdown>

      {/* Ingredient selection modal */}
      <Modal
        isOpen={selectModal.isOpen}
        scrollBehavior="inside"
        size="md"
        onClose={selectModal.onClose}
      >
        <ModalContent>
          <ModalHeader className="flex flex-col gap-1">
            <span>Select Ingredients</span>
            <span className="text-default-500 text-sm font-normal">
              Choose which ingredients to add to KitchenOwl
            </span>
          </ModalHeader>

          <ModalBody>
            <CheckboxGroup value={selectedIds} onValueChange={setSelectedIds}>
              <div className="space-y-2">
                {currentIngredients.map((ingredient, idx) => {
                  const isHeading = ingredient.ingredientName.trim().startsWith("#");

                  if (isHeading) {
                    const headingText = ingredient.ingredientName.trim().replace(/^#+\s*/, "");
                    return (
                      <div key={`heading-${idx}`} className="pt-3 pb-1">
                        <h3 className="text-foreground text-sm font-semibold">{headingText}</h3>
                      </div>
                    );
                  }

                  // Skip ingredients without a valid ID
                  if (!ingredient.ingredientId) {
                    return null;
                  }

                  return (
                    <Checkbox key={ingredient.ingredientId} value={ingredient.ingredientId}>
                      <IngredientLabel ingredient={ingredient} />
                    </Checkbox>
                  );
                })}
              </div>
            </CheckboxGroup>
          </ModalBody>

          <ModalFooter>
            <Button variant="flat" onPress={selectModal.onClose}>
              Cancel
            </Button>
            <Button
              color="primary"
              isLoading={isLoading}
              onPress={handleSendSelected}
            >
              Add {selectedIds.length} item{selectedIds.length !== 1 ? "s" : ""}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}

// Helper component to format ingredient label
function IngredientLabel({ ingredient }: { ingredient: RecipeIngredientsDto }) {
  const amount = formatAmount(ingredient.amount);
  const unit = ingredient.unit || "";

  return (
    <span className="text-sm">
      {amount && <span className="font-medium">{amount} </span>}
      {unit && <span className="text-primary-600 dark:text-primary-400">{unit} </span>}
      <span className="text-default-700 dark:text-default-300">{ingredient.ingredientName}</span>
    </span>
  );
}

// Format amount as a clean decimal
function formatAmount(n: number | null | string): string {
  if (n == null || n === "") return "";

  const num = typeof n === "string" ? parseFloat(n) : n;

  if (isNaN(num)) return String(n);
  if (Number.isInteger(num)) return String(num);

  return num.toFixed(2).replace(/\.?0+$/, "");
}
