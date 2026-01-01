"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardBody,
  CardHeader,
  Input,
  Button,
  Select,
  SelectItem,
  Chip,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
  addToast,
  Link,
} from "@heroui/react";
import {
  ServerIcon,
  EyeIcon,
  EyeSlashIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  TrashIcon,
  ArrowPathIcon,
} from "@heroicons/react/24/outline";
import { CheckIcon, XMarkIcon } from "@heroicons/react/16/solid";

import {
  useKitchenOwlConfig,
  useKitchenOwlMutations,
} from "@/hooks/integrations/use-kitchenowl";
import type {
  KitchenOwlHousehold,
  KitchenOwlShoppingList,
} from "@/lib/integrations/kitchenowl";
import { useTRPC } from "@/app/providers/trpc-provider";
import { useQuery } from "@tanstack/react-query";

export default function KitchenOwlConfigCard() {
  const { config, isLoading, isConfigured, isEnabled } = useKitchenOwlConfig();
  const { saveConfig, deleteConfig, testConnection } =
    useKitchenOwlMutations();
  const trpc = useTRPC();
  const deleteModal = useDisclosure();

  // Form state
  const [serverUrl, setServerUrl] = useState("");
  const [apiToken, setApiToken] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [selectedHouseholdId, setSelectedHouseholdId] = useState<
    number | null
  >(null);
  const [selectedShoppingListId, setSelectedShoppingListId] = useState<
    number | null
  >(null);

  // Test connection state
  const [households, setHouseholds] = useState<KitchenOwlHousehold[]>([]);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  // Query for shopping lists when household is selected
  const shoppingListsQuery = useQuery({
    ...trpc.integrations.getShoppingLists.queryOptions({
      householdId: selectedHouseholdId!,
    }),
    enabled: !!selectedHouseholdId && isConfigured,
  });

  // Initialize form with existing config
  useEffect(() => {
    if (config) {
      setServerUrl(config.serverUrl || "");
      setSelectedHouseholdId(config.defaultHouseholdId ?? null);
      setSelectedShoppingListId(config.defaultShoppingListId ?? null);
    }
  }, [config]);

  const handleTestConnection = async () => {
    if (!serverUrl || !apiToken) {
      addToast({
        title: "Missing fields",
        description: "Please enter server URL and API token",
        color: "warning",
      });
      return;
    }

    setTestResult(null);
    setHouseholds([]);

    try {
      const result = await testConnection.mutateAsync({
        serverUrl,
        apiToken,
      });

      if (result.success && result.households) {
        setHouseholds(result.households);
        setTestResult({
          success: true,
          message: `Connection successful! Found ${result.households.length} household(s).`,
        });

        // Auto-select first household if only one
        if (result.households.length === 1) {
          setSelectedHouseholdId(result.households[0].id);
        }
      } else {
        setTestResult({
          success: false,
          message: result.error || "Connection failed",
        });
      }
    } catch {
      setTestResult({
        success: false,
        message: "Failed to test connection",
      });
    }
  };

  const handleSave = async () => {
    if (!serverUrl || !apiToken) {
      addToast({
        title: "Missing fields",
        description: "Please enter server URL and API token",
        color: "warning",
      });
      return;
    }

    if (!selectedHouseholdId) {
      addToast({
        title: "Select household",
        description: "Please test connection and select a household",
        color: "warning",
      });
      return;
    }

    try {
      await saveConfig.mutateAsync({
        serverUrl,
        apiToken,
        defaultHouseholdId: selectedHouseholdId,
        defaultShoppingListId: selectedShoppingListId ?? undefined,
      });

      addToast({
        title: "Configuration saved",
        description: "KitchenOwl integration is now configured",
        color: "success",
      });

      // Clear token from form after saving
      setApiToken("");
      setShowToken(false);
    } catch {
      addToast({
        title: "Save failed",
        description: "Failed to save configuration",
        color: "danger",
      });
    }
  };

  const handleDisconnect = async () => {
    try {
      await deleteConfig.mutateAsync();
      addToast({
        title: "Disconnected",
        description: "KitchenOwl integration has been removed",
        color: "success",
      });

      // Reset form state
      setServerUrl("");
      setApiToken("");
      setSelectedHouseholdId(null);
      setSelectedShoppingListId(null);
      setHouseholds([]);
      setTestResult(null);
      deleteModal.onClose();
    } catch {
      addToast({
        title: "Disconnect failed",
        description: "Failed to remove configuration",
        color: "danger",
      });
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardBody>
          <div className="flex items-center justify-center py-8">
            <ArrowPathIcon className="h-6 w-6 animate-spin" />
          </div>
        </CardBody>
      </Card>
    );
  }

  // Connected state view
  if (isConfigured && !apiToken) {
    return (
      <>
        <Card>
          <CardHeader>
            <div className="flex w-full items-center justify-between">
              <div className="flex items-center gap-3">
                <ServerIcon className="text-primary h-6 w-6" />
                <div>
                  <h2 className="text-lg font-semibold">KitchenOwl</h2>
                  <p className="text-default-500 text-base">
                    Shopping list integration
                  </p>
                </div>
              </div>
              <Chip
                color={isEnabled ? "success" : "warning"}
                startContent={
                  isEnabled ? (
                    <CheckCircleIcon className="h-4 w-4" />
                  ) : (
                    <ExclamationTriangleIcon className="h-4 w-4" />
                  )
                }
                variant="flat"
              >
                {isEnabled ? "Connected" : "Configured"}
              </Chip>
            </div>
          </CardHeader>

          <CardBody className="gap-4">
            <div className="bg-default-100 rounded-lg p-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-default-500 text-xs">Server URL</p>
                  <p className="font-medium">{config?.serverUrl}</p>
                </div>
                <div>
                  <p className="text-default-500 text-xs">API Token</p>
                  <p className="font-mono text-sm">{config?.apiTokenMasked}</p>
                </div>
                {config?.defaultHouseholdId && (
                  <div>
                    <p className="text-default-500 text-xs">Household ID</p>
                    <p className="font-medium">{config.defaultHouseholdId}</p>
                  </div>
                )}
                {config?.defaultShoppingListId && (
                  <div>
                    <p className="text-default-500 text-xs">
                      Default Shopping List ID
                    </p>
                    <p className="font-medium">
                      {config.defaultShoppingListId}
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-between">
              <Button
                color="danger"
                startContent={<TrashIcon className="h-4 w-4" />}
                variant="flat"
                onPress={deleteModal.onOpen}
              >
                Disconnect
              </Button>
              <Button
                variant="bordered"
                onPress={() => {
                  // Switch to edit mode
                  setApiToken("");
                  setShowToken(false);
                }}
              >
                Update Configuration
              </Button>
            </div>
          </CardBody>
        </Card>

        <Modal isOpen={deleteModal.isOpen} onClose={deleteModal.onClose}>
          <ModalContent>
            <ModalHeader className="flex items-center gap-2">
              <ExclamationTriangleIcon className="text-danger h-5 w-5" />
              Disconnect KitchenOwl
            </ModalHeader>
            <ModalBody>
              <p>
                Are you sure you want to disconnect KitchenOwl? You will need to
                reconfigure the integration to use it again.
              </p>
            </ModalBody>
            <ModalFooter>
              <Button variant="flat" onPress={deleteModal.onClose}>
                Cancel
              </Button>
              <Button
                color="danger"
                isLoading={deleteConfig.isPending}
                onPress={handleDisconnect}
              >
                Disconnect
              </Button>
            </ModalFooter>
          </ModalContent>
        </Modal>
      </>
    );
  }

  // Setup/edit form view
  const canTest = serverUrl && apiToken;
  const canSave = serverUrl && apiToken && selectedHouseholdId;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <ServerIcon className="text-primary h-6 w-6" />
          <div>
            <h2 className="text-lg font-semibold">
              {isConfigured ? "Update KitchenOwl" : "Setup KitchenOwl"}
            </h2>
            <p className="text-default-500 text-base">
              Connect to your KitchenOwl server to send recipe ingredients to
              shopping lists
            </p>
          </div>
        </div>
      </CardHeader>

      <CardBody className="gap-4">
        {/* Info section */}
        <div className="bg-primary/10 border-primary/20 rounded-lg border p-4">
          <div className="flex gap-3">
            <InformationCircleIcon className="text-primary mt-0.5 h-5 w-5 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-primary mb-2 text-base font-medium">
                About KitchenOwl
              </p>
              <p className="text-default-600 text-xs">
                KitchenOwl is a self-hosted grocery list and recipe manager.
                This integration allows you to send recipe ingredients directly
                to your KitchenOwl shopping list.
              </p>
              <Link
                isExternal
                className="mt-2 text-xs"
                href="https://kitchenowl.org/"
                target="_blank"
              >
                Learn more about KitchenOwl
              </Link>
            </div>
          </div>
        </div>

        {/* Form fields */}
        <Input
          isRequired
          description="Your KitchenOwl server URL (e.g., https://kitchenowl.example.com)"
          label="Server URL"
          placeholder="https://kitchenowl.example.com"
          value={serverUrl}
          onValueChange={setServerUrl}
        />

        <Input
          isRequired
          description={
            isConfigured
              ? "Enter a new API token to update, or leave empty to keep current"
              : "Create an API token in KitchenOwl Settings > Profile"
          }
          endContent={
            <button
              className="focus:outline-none"
              type="button"
              onClick={() => setShowToken(!showToken)}
            >
              {showToken ? (
                <EyeSlashIcon className="text-default-400 h-4 w-4" />
              ) : (
                <EyeIcon className="text-default-400 h-4 w-4" />
              )}
            </button>
          }
          label="API Token"
          placeholder={isConfigured ? "Enter new token to update" : "Your API token"}
          type={showToken ? "text" : "password"}
          value={apiToken}
          onValueChange={setApiToken}
        />

        {/* Test connection result */}
        {testResult && (
          <div
            className={`flex items-center gap-2 rounded-lg p-3 ${
              testResult.success
                ? "bg-success/10 text-success"
                : "bg-danger/10 text-danger"
            }`}
          >
            {testResult.success ? (
              <CheckIcon className="h-5 w-5" />
            ) : (
              <XMarkIcon className="h-5 w-5" />
            )}
            {testResult.message}
          </div>
        )}

        {/* Test connection button */}
        <div className="flex justify-end">
          <Button
            isDisabled={!canTest}
            isLoading={testConnection.isPending}
            variant="bordered"
            onPress={handleTestConnection}
          >
            Test Connection
          </Button>
        </div>

        {/* Household and shopping list selects - shown after successful test */}
        {(households.length > 0 || isConfigured) && (
          <>
            <Select
              isRequired
              description="Select the household to use for shopping lists"
              label="Household"
              placeholder="Select a household"
              selectedKeys={
                selectedHouseholdId ? [String(selectedHouseholdId)] : []
              }
              onSelectionChange={(keys) => {
                const selected = Array.from(keys)[0];
                setSelectedHouseholdId(
                  selected ? Number(selected) : null
                );
                setSelectedShoppingListId(null);
              }}
            >
              {households.map((household) => (
                <SelectItem key={String(household.id)}>
                  {household.name}
                </SelectItem>
              ))}
            </Select>

            {selectedHouseholdId && isConfigured && (
              <Select
                description="Optionally select a default shopping list"
                isLoading={shoppingListsQuery.isLoading}
                label="Default Shopping List (optional)"
                placeholder="Select a shopping list"
                selectedKeys={
                  selectedShoppingListId
                    ? [String(selectedShoppingListId)]
                    : []
                }
                onSelectionChange={(keys) => {
                  const selected = Array.from(keys)[0];
                  setSelectedShoppingListId(
                    selected ? Number(selected) : null
                  );
                }}
              >
                {(shoppingListsQuery.data || []).map(
                  (list: KitchenOwlShoppingList) => (
                    <SelectItem key={String(list.id)}>{list.name}</SelectItem>
                  )
                )}
              </Select>
            )}
          </>
        )}

        {/* Action buttons */}
        <div className="flex justify-end gap-2">
          {isConfigured && (
            <Button
              variant="flat"
              onPress={() => {
                setApiToken("");
                setServerUrl(config?.serverUrl || "");
                setTestResult(null);
                setHouseholds([]);
              }}
            >
              Cancel
            </Button>
          )}
          <Button
            color="primary"
            isDisabled={!canSave}
            isLoading={saveConfig.isPending}
            onPress={handleSave}
          >
            Save Configuration
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}
