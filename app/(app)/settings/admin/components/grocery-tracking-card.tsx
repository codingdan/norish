"use client";

import { Card, CardBody, CardHeader, Switch } from "@heroui/react";
import { ShoppingBagIcon } from "@heroicons/react/16/solid";

import { useAdminSettingsContext } from "../context";

export default function GroceryTrackingCard() {
  const { groceryTrackingEnabled, updateGroceryTracking, isLoading } = useAdminSettingsContext();

  const handleToggle = async (checked: boolean) => {
    await updateGroceryTracking(checked);
  };

  return (
    <Card>
      <CardHeader>
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <ShoppingBagIcon className="h-5 w-5" />
          Grocery Tracking
        </h2>
      </CardHeader>
      <CardBody>
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <span className="font-medium">Enable local grocery list</span>
            <span className="text-default-500 text-base">
              When disabled, the grocery list page is hidden. Users can still send ingredients to
              external integrations like KitchenOwl.
            </span>
          </div>
          <Switch
            color="success"
            isDisabled={isLoading}
            isSelected={groceryTrackingEnabled ?? true}
            onValueChange={handleToggle}
          />
        </div>
      </CardBody>
    </Card>
  );
}
