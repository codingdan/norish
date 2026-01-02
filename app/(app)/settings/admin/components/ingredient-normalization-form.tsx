"use client";

import { useState } from "react";
import {
  Switch,
  Input,
  Button,
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Chip,
  Pagination,
  Spinner,
  addToast,
} from "@heroui/react";
import {
  ExclamationTriangleIcon,
  TrashIcon,
  PencilIcon,
  CheckIcon,
  XMarkIcon,
  PlusIcon,
} from "@heroicons/react/24/outline";
import { formatDistanceToNow } from "date-fns";

import { useAdminSettingsContext } from "../context";
import {
  useIngredientCacheQuery,
  useIngredientCacheMutations,
} from "@/hooks/admin";

function CacheManagementSection() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [newRawName, setNewRawName] = useState("");
  const [newNormalizedName, setNewNormalizedName] = useState("");

  const { data, isLoading, error } = useIngredientCacheQuery(page, search || undefined);
  const { add, update, remove, clear, isAdding, isUpdating, isClearing } =
    useIngredientCacheMutations();

  const handleAdd = async () => {
    if (!newRawName.trim() || !newNormalizedName.trim()) return;

    try {
      await add(newRawName.trim(), newNormalizedName.trim());
      setNewRawName("");
      setNewNormalizedName("");
      addToast({
        title: "Mapping added",
        color: "success",
        timeout: 2000,
        shouldShowTimeoutProgress: true,
        radius: "full",
      });
    } catch (err) {
      addToast({
        title: "Failed to add mapping",
        description: (err as Error).message,
        color: "danger",
        timeout: 3000,
        shouldShowTimeoutProgress: true,
        radius: "full",
      });
    }
  };

  const handleEdit = (id: string, currentValue: string) => {
    setEditingId(id);
    setEditValue(currentValue);
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editValue.trim()) return;

    try {
      await update(editingId, editValue.trim());
      setEditingId(null);
      setEditValue("");
      addToast({
        title: "Mapping updated",
        color: "success",
        timeout: 2000,
        shouldShowTimeoutProgress: true,
        radius: "full",
      });
    } catch (err) {
      addToast({
        title: "Failed to update mapping",
        description: (err as Error).message,
        color: "danger",
        timeout: 3000,
        shouldShowTimeoutProgress: true,
        radius: "full",
      });
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditValue("");
  };

  const handleDelete = async (id: string) => {
    try {
      await remove(id);
      addToast({
        title: "Mapping deleted",
        color: "success",
        timeout: 2000,
        shouldShowTimeoutProgress: true,
        radius: "full",
      });
    } catch (err) {
      addToast({
        title: "Failed to delete mapping",
        description: (err as Error).message,
        color: "danger",
        timeout: 3000,
        shouldShowTimeoutProgress: true,
        radius: "full",
      });
    }
  };

  const handleClear = async () => {
    try {
      const result = await clear();
      addToast({
        title: `Cleared ${result.count} mappings`,
        color: "success",
        timeout: 2000,
        shouldShowTimeoutProgress: true,
        radius: "full",
      });
      setPage(1);
    } catch (err) {
      addToast({
        title: "Failed to clear cache",
        description: (err as Error).message,
        color: "danger",
        timeout: 3000,
        shouldShowTimeoutProgress: true,
        radius: "full",
      });
    }
  };

  const formatDate = (dateString: string | Date | null | undefined) => {
    if (!dateString) return "-";
    try {
      const date = typeof dateString === "string" ? new Date(dateString) : dateString;
      return formatDistanceToNow(date, { addSuffix: true });
    } catch {
      return "-";
    }
  };

  const getSourceColor = (source: string) => {
    switch (source) {
      case "ai":
        return "primary";
      case "manual":
        return "secondary";
      case "fallback":
        return "default";
      default:
        return "default";
    }
  };

  const pageSize = 20;
  const totalPages = Math.ceil((data?.total ?? 0) / pageSize);

  if (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return (
      <div className="py-4 text-center text-danger">
        Failed to load cache entries: {errorMessage}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium">Cached Mappings</h3>
          <Chip size="sm" variant="flat">
            {data?.total ?? 0}
          </Chip>
        </div>
        <Button
          color="danger"
          isDisabled={!data?.total || isClearing}
          isLoading={isClearing}
          size="sm"
          variant="flat"
          onPress={handleClear}
        >
          Reset Cache
        </Button>
      </div>

      {/* Search */}
      <Input
        placeholder="Search by original name..."
        size="sm"
        value={search}
        onValueChange={(v) => {
          setSearch(v);
          setPage(1);
        }}
      />

      {/* Table */}
      <Table
        aria-label="Ingredient name mappings cache"
        classNames={{
          wrapper: "p-0",
        }}
      >
        <TableHeader>
          <TableColumn>Original Name</TableColumn>
          <TableColumn>Normalized Name</TableColumn>
          <TableColumn>Source</TableColumn>
          <TableColumn>Created</TableColumn>
          <TableColumn width={100}>Actions</TableColumn>
        </TableHeader>
        <TableBody
          emptyContent={
            isLoading ? (
              <div className="flex justify-center py-4">
                <Spinner size="sm" />
              </div>
            ) : (
              "No cached mappings"
            )
          }
          isLoading={isLoading}
        >
          {[
            // Add row (always first)
            <TableRow key="add-row">
              <TableCell>
                <Input
                  placeholder="Original name"
                  size="sm"
                  value={newRawName}
                  onValueChange={setNewRawName}
                />
              </TableCell>
              <TableCell>
                <Input
                  placeholder="Normalized name"
                  size="sm"
                  value={newNormalizedName}
                  onValueChange={setNewNormalizedName}
                />
              </TableCell>
              <TableCell>
                <Chip color="secondary" size="sm" variant="flat">
                  Manual
                </Chip>
              </TableCell>
              <TableCell>-</TableCell>
              <TableCell>
                <Button
                  color="primary"
                  isDisabled={!newRawName.trim() || !newNormalizedName.trim()}
                  isIconOnly
                  isLoading={isAdding}
                  size="sm"
                  variant="flat"
                  onPress={handleAdd}
                >
                  <PlusIcon className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>,
            // Data rows
            ...(data?.entries ?? []).map((entry) => (
              <TableRow key={entry.id}>
                <TableCell className="font-mono text-sm">{entry.rawName}</TableCell>
                <TableCell>
                  {editingId === entry.id ? (
                    <Input
                      size="sm"
                      value={editValue}
                      onValueChange={setEditValue}
                    />
                  ) : (
                    <span className="font-mono text-sm">{entry.normalizedName}</span>
                  )}
                </TableCell>
                <TableCell>
                  <Chip
                    className="capitalize"
                    color={getSourceColor(entry.source)}
                    size="sm"
                    variant="flat"
                  >
                    {entry.source}
                  </Chip>
                </TableCell>
                <TableCell className="text-default-500 text-xs">
                  {formatDate(entry.createdAt)}
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    {editingId === entry.id ? (
                      <>
                        <Button
                          color="success"
                          isIconOnly
                          isLoading={isUpdating}
                          size="sm"
                          variant="light"
                          onPress={handleSaveEdit}
                        >
                          <CheckIcon className="h-4 w-4" />
                        </Button>
                        <Button
                          color="default"
                          isIconOnly
                          size="sm"
                          variant="light"
                          onPress={handleCancelEdit}
                        >
                          <XMarkIcon className="h-4 w-4" />
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          color="default"
                          isIconOnly
                          size="sm"
                          variant="light"
                          onPress={() => handleEdit(entry.id, entry.normalizedName)}
                        >
                          <PencilIcon className="h-4 w-4" />
                        </Button>
                        <Button
                          color="danger"
                          isIconOnly
                          size="sm"
                          variant="light"
                          onPress={() => handleDelete(entry.id)}
                        >
                          <TrashIcon className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            )),
          ]}
        </TableBody>
      </Table>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center">
          <Pagination
            showControls
            page={page}
            size="sm"
            total={totalPages}
            onChange={setPage}
          />
        </div>
      )}
    </div>
  );
}

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

      <div className="border-t border-default-200 pt-4">
        <p className="text-xs text-default-400">
          When AI normalization is disabled, a local regex-based fallback is
          used to strip quantities and modifiers from ingredient names.
        </p>
      </div>

      {/* Cache Management Section */}
      <div className="border-t border-default-200 pt-6">
        <CacheManagementSection />
      </div>
    </div>
  );
}
