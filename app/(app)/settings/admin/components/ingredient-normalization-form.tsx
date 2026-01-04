"use client";

import { Switch, Input } from "@heroui/react";
import { ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import { useAdminSettingsContext } from "../context";
import IngredientCacheTable from "./ingredient-cache-table";

export default function IngredientNormalizationForm() {
  const { aiConfig, updateAIConfig } = useAdminSettingsContext();

  if (!aiConfig) {
    return (
      <div className="py-4 text-center text-default-500">
        AI must be configured before setting up ingredient normalization.
      </div>
    );
  }

  const aiGloballyEnabled = aiConfig.enabled;

  const handleToggle = async (key: string, value: boolean) => {
    await updateAIConfig({ ...aiConfig, [key]: value });
  };

  const handleModelChange = async (value: string) => {
    await updateAIConfig({
      ...aiConfig,
      ingredientNormalizationModel: value || undefined,
    });
  };

  return (
    <div className="space-y-6 py-2">
      <p className="text-default-500 text-sm">
        Configure how ingredient names are normalized when sending to shopping
        list integrations like KitchenOwl.
      </p>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <p className="text-sm font-medium">Enable normalization</p>
            <p className="text-xs text-default-500">
              Clean up ingredient names for better matching in shopping lists
            </p>
          </div>
          <Switch
            isSelected={aiConfig.enableIngredientNormalization ?? true}
            onValueChange={(v) => handleToggle("enableIngredientNormalization", v)}
          />
        </div>

        {aiConfig.enableIngredientNormalization !== false && (
          <>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <p className="text-sm font-medium">Use AI normalization</p>
                <p className="text-xs text-default-500">
                  Use AI to extract ingredient base names (e.g., &quot;onion
                  (diced)&quot; → &quot;onion&quot;)
                </p>
              </div>
              <Switch
                isSelected={aiConfig.useAiIngredientNormalization ?? true}
                onValueChange={(v) =>
                  handleToggle("useAiIngredientNormalization", v)
                }
              />
            </div>

            {aiConfig.useAiIngredientNormalization !== false && !aiGloballyEnabled && (
              <div className="flex items-start gap-2 rounded-lg bg-warning-50 p-3 text-warning-700">
                <ExclamationTriangleIcon className="h-5 w-5 flex-shrink-0 mt-0.5" />
                <p className="text-sm">
                  AI is not enabled globally. Enable it in the &quot;AI Configuration&quot; section above for AI normalization to work. Local fallback will be used until then.
                </p>
              </div>
            )}

            {aiConfig.useAiIngredientNormalization !== false && aiGloballyEnabled && (
              <Input
                label="Model override (optional)"
                placeholder="Leave empty to use default AI model"
                description="Override the AI model used for ingredient normalization"
                value={aiConfig.ingredientNormalizationModel ?? ""}
                onValueChange={handleModelChange}
              />
            )}
          </>
        )}
      </div>

      <div className="border-t border-default-200 pt-4 space-y-4">
        <IngredientCacheTable />
        <p className="text-xs text-default-400">
          When AI normalization is disabled, a local regex-based fallback is
          used to strip quantities and modifiers from ingredient names.
        </p>
      </div>
    </div>
  );
}
