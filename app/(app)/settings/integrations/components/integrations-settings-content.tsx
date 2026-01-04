"use client";

import KitchenOwlConfigCard from "./kitchenowl-config-card";

export default function IntegrationsSettingsContent() {
  return (
    <div className="flex w-full flex-col gap-6">
      <div>
        <p className="text-default-500">
          Connect Norish with other apps and services
        </p>
      </div>

      <KitchenOwlConfigCard />
    </div>
  );
}
