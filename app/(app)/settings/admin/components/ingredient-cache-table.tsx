"use client";

import { useState } from "react";
import {
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Input,
  Button,
  Chip,
  Pagination,
  Spinner,
} from "@heroui/react";
import {
  PencilIcon,
  TrashIcon,
  CheckIcon,
  XMarkIcon,
  PlusIcon,
} from "@heroicons/react/24/outline";

import { useIngredientCache } from "@/hooks/admin";
import type { IngredientNameMapping } from "@/server/db/schema/ingredient-mappings";

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 30) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

const sourceColors: Record<string, "primary" | "success" | "secondary"> = {
  ai: "primary",
  manual: "success",
  fallback: "secondary",
};

const PAGE_LIMIT = 20;

export default function IngredientCacheTable() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Add row state
  const [newOriginal, setNewOriginal] = useState("");
  const [newNormalized, setNewNormalized] = useState("");

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const {
    entries,
    total,
    isLoading,
    add,
    update,
    delete: deleteEntry,
    clear,
    isAdding,
    isUpdating,
    isDeleting,
    isClearing,
  } = useIngredientCache(page, debouncedSearch || undefined);

  const totalPages = Math.ceil(total / PAGE_LIMIT);

  // Debounced search
  const handleSearchChange = (value: string) => {
    setSearch(value);
    // Simple debounce using setTimeout
    const timeoutId = setTimeout(() => {
      setDebouncedSearch(value);
      setPage(1);
    }, 300);
    return () => clearTimeout(timeoutId);
  };

  const handleAdd = async () => {
    if (!newOriginal.trim() || !newNormalized.trim()) return;
    await add({ rawName: newOriginal.trim(), normalizedName: newNormalized.trim() });
    setNewOriginal("");
    setNewNormalized("");
  };

  const handleStartEdit = (entry: IngredientNameMapping) => {
    setEditingId(entry.id);
    setEditValue(entry.normalizedName);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditValue("");
  };

  const handleSaveEdit = async (id: string) => {
    if (!editValue.trim()) return;
    await update({ id, normalizedName: editValue.trim() });
    setEditingId(null);
    setEditValue("");
  };

  const handleDelete = async (id: string) => {
    await deleteEntry({ id });
  };

  const handleClear = async () => {
    if (confirm("Are you sure you want to clear all cached mappings? This cannot be undone.")) {
      await clear();
      setPage(1);
    }
  };

  if (isLoading && entries.length === 0) {
    return (
      <div className="flex items-center justify-center p-8">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header row */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-medium">Cached Mappings</h3>
          <Chip size="sm" variant="flat">
            {total}
          </Chip>
        </div>
        <div className="flex items-center gap-2">
          <Input
            className="w-full sm:w-64"
            placeholder="Search mappings..."
            size="sm"
            value={search}
            onValueChange={handleSearchChange}
          />
          <Button
            color="danger"
            isDisabled={total === 0}
            isLoading={isClearing}
            size="sm"
            variant="flat"
            onPress={handleClear}
          >
            Reset Cache
          </Button>
        </div>
      </div>

      {/* Add row */}
      <div className="flex items-end gap-2">
        <Input
          className="flex-1"
          label="Original Name"
          placeholder="e.g., 1 cup diced onion"
          size="sm"
          value={newOriginal}
          onValueChange={setNewOriginal}
        />
        <Input
          className="flex-1"
          label="Normalized Name"
          placeholder="e.g., onion"
          size="sm"
          value={newNormalized}
          onValueChange={setNewNormalized}
        />
        <Button
          color="primary"
          isDisabled={!newOriginal.trim() || !newNormalized.trim()}
          isLoading={isAdding}
          size="sm"
          startContent={!isAdding && <PlusIcon className="h-4 w-4" />}
          onPress={handleAdd}
        >
          Add
        </Button>
      </div>

      {/* Table */}
      <Table
        aria-label="Ingredient cache mappings"
        classNames={{
          wrapper: "p-0",
        }}
      >
        <TableHeader>
          <TableColumn>ORIGINAL</TableColumn>
          <TableColumn>NORMALIZED</TableColumn>
          <TableColumn>SOURCE</TableColumn>
          <TableColumn>CREATED</TableColumn>
          <TableColumn>ACTIONS</TableColumn>
        </TableHeader>
        <TableBody emptyContent="No cached mappings found">
          {entries.map((entry) => (
            <TableRow key={entry.id}>
              <TableCell className="font-mono text-sm">{entry.rawName}</TableCell>
              <TableCell>
                {editingId === entry.id ? (
                  <Input
                    autoFocus
                    size="sm"
                    value={editValue}
                    onValueChange={setEditValue}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSaveEdit(entry.id);
                      if (e.key === "Escape") handleCancelEdit();
                    }}
                  />
                ) : (
                  <span className="font-mono text-sm">{entry.normalizedName}</span>
                )}
              </TableCell>
              <TableCell>
                <Chip
                  color={sourceColors[entry.source] || "default"}
                  size="sm"
                  variant="flat"
                >
                  {entry.source}
                </Chip>
              </TableCell>
              <TableCell className="text-default-500 text-xs">
                {formatRelativeTime(new Date(entry.createdAt))}
              </TableCell>
              <TableCell>
                <div className="flex gap-1">
                  {editingId === entry.id ? (
                    <>
                      <Button
                        isIconOnly
                        color="success"
                        isLoading={isUpdating}
                        size="sm"
                        title="Save"
                        variant="light"
                        onPress={() => handleSaveEdit(entry.id)}
                      >
                        <CheckIcon className="h-4 w-4" />
                      </Button>
                      <Button
                        isIconOnly
                        color="default"
                        size="sm"
                        title="Cancel"
                        variant="light"
                        onPress={handleCancelEdit}
                      >
                        <XMarkIcon className="h-4 w-4" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        isIconOnly
                        color="default"
                        size="sm"
                        title="Edit normalized name"
                        variant="light"
                        onPress={() => handleStartEdit(entry)}
                      >
                        <PencilIcon className="h-4 w-4" />
                      </Button>
                      <Button
                        isIconOnly
                        color="danger"
                        isLoading={isDeleting}
                        size="sm"
                        title="Delete mapping"
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
          ))}
        </TableBody>
      </Table>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-2 flex justify-center">
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
