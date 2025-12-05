"use client";

import React, { useState, useMemo } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Edit, Trash2, ChevronRight, ChevronDown } from "lucide-react";
import type { SystemGroup, SystemCategory, SystemSubcategory } from "@/src/domain/admin/admin.types";
import { useConfirmDialog } from "@/hooks/use-confirm-dialog";

interface SelectedItem {
  id: string;
  type: "group" | "category" | "subcategory";
}

interface UnifiedEntitiesTableProps {
  groups: SystemGroup[];
  categories: SystemCategory[];
  subcategories: SystemSubcategory[];
  loading?: boolean;
  onEditGroup: (group: SystemGroup) => void;
  onDeleteGroup: (id: string) => void;
  onEditCategory: (category: SystemCategory) => void;
  onDeleteCategory: (id: string) => void;
  onEditSubcategory: (subcategory: SystemSubcategory) => void;
  onDeleteSubcategory: (id: string) => void;
  onBulkDelete?: (items: SelectedItem[]) => void;
}

interface ExpandedState {
  groups: Set<string>;
  categories: Set<string>;
}

export function UnifiedEntitiesTable({
  groups,
  categories,
  subcategories,
  loading,
  onEditGroup,
  onDeleteGroup,
  onEditCategory,
  onDeleteCategory,
  onEditSubcategory,
  onDeleteSubcategory,
  onBulkDelete,
}: UnifiedEntitiesTableProps) {
  const { openDialog, ConfirmDialog } = useConfirmDialog();
  const [expanded, setExpanded] = useState<ExpandedState>({
    groups: new Set(),
    categories: new Set(),
  });
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deletingType, setDeletingType] = useState<"group" | "category" | "subcategory" | null>(null);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

  const toggleGroup = (groupId: string) => {
    const newExpanded = { ...expanded };
    if (newExpanded.groups.has(groupId)) {
      newExpanded.groups.delete(groupId);
      // Also collapse all categories in this group
      categories
        .filter((c) => c.macroId === groupId)
        .forEach((c) => newExpanded.categories.delete(c.id));
    } else {
      newExpanded.groups.add(groupId);
    }
    setExpanded(newExpanded);
  };

  const toggleCategory = (categoryId: string) => {
    const newExpanded = { ...expanded };
    if (newExpanded.categories.has(categoryId)) {
      newExpanded.categories.delete(categoryId);
    } else {
      newExpanded.categories.add(categoryId);
    }
    setExpanded(newExpanded);
  };

  const handleDelete = (
    id: string,
    type: "group" | "category" | "subcategory",
    name: string
  ) => {
    const typeLabels = {
      group: "group",
      category: "category",
      subcategory: "subcategory",
    };

    const deleteHandlers = {
      group: onDeleteGroup,
      category: onDeleteCategory,
      subcategory: onDeleteSubcategory,
    };

    openDialog(
      {
        title: `Delete ${typeLabels[type]}`,
        description: `Are you sure you want to delete "${name}"? This action cannot be undone.`,
        variant: "destructive",
        confirmLabel: "Delete",
      },
      async () => {
        setDeletingId(id);
        setDeletingType(type);
        try {
          await deleteHandlers[type](id);
          // Remove from selection if it was selected
          setSelectedItems((prev) => {
            const next = new Set(prev);
            next.delete(`${type}:${id}`);
            return next;
          });
        } catch (error) {
          console.error(`Error deleting ${type}:`, error);
          alert(error instanceof Error ? error.message : `Failed to delete ${typeLabels[type]}`);
        } finally {
          setDeletingId(null);
          setDeletingType(null);
        }
      }
    );
  };

  const toggleSelection = (id: string, type: "group" | "category" | "subcategory") => {
    const key = `${type}:${id}`;
    setSelectedItems((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const isSelected = (id: string, type: "group" | "category" | "subcategory") => {
    return selectedItems.has(`${type}:${id}`);
  };

  // Get all visible items for select all functionality
  const allVisibleItems = useMemo(() => {
    const items: SelectedItem[] = [];
    groups.forEach((group) => {
      items.push({ id: group.id, type: "group" });
      if (expanded.groups.has(group.id)) {
        const groupCategories = categories.filter((c) => c.macroId === group.id);
        groupCategories.forEach((category) => {
          items.push({ id: category.id, type: "category" });
          if (expanded.categories.has(category.id)) {
            const categorySubcategories = subcategories.filter((s) => s.categoryId === category.id);
            categorySubcategories.forEach((subcategory) => {
              items.push({ id: subcategory.id, type: "subcategory" });
            });
          }
        });
      }
    });
    return items;
  }, [groups, categories, subcategories, expanded]);

  const allVisibleSelected = useMemo(() => {
    return allVisibleItems.every((item) => selectedItems.has(`${item.type}:${item.id}`));
  }, [allVisibleItems, selectedItems]);

  const someVisibleSelected = useMemo(() => {
    return allVisibleItems.some((item) => selectedItems.has(`${item.type}:${item.id}`));
  }, [allVisibleItems, selectedItems]);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const newSelected = new Set(selectedItems);
      allVisibleItems.forEach((item) => {
        newSelected.add(`${item.type}:${item.id}`);
      });
      setSelectedItems(newSelected);
    } else {
      const newSelected = new Set(selectedItems);
      allVisibleItems.forEach((item) => {
        newSelected.delete(`${item.type}:${item.id}`);
      });
      setSelectedItems(newSelected);
    }
  };

  const handleBulkDelete = () => {
    if (!onBulkDelete || selectedItems.size === 0) return;

    const itemsToDelete: SelectedItem[] = Array.from(selectedItems).map((key) => {
      const [type, id] = key.split(":");
      return { id, type: type as "group" | "category" | "subcategory" };
    });

    const count = itemsToDelete.length;
    const typeLabels = {
      group: "groups",
      category: "categories",
      subcategory: "subcategories",
    };

    const counts = itemsToDelete.reduce(
      (acc, item) => {
        acc[item.type] = (acc[item.type] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    const descriptionParts = Object.entries(counts)
      .map(([type, count]) => `${count} ${typeLabels[type as keyof typeof typeLabels]}`)
      .join(", ");

    openDialog(
      {
        title: `Delete ${count} item${count > 1 ? "s" : ""}`,
        description: `Are you sure you want to delete ${descriptionParts}? This action cannot be undone.`,
        variant: "destructive",
        confirmLabel: "Delete",
      },
      async () => {
        try {
          await onBulkDelete(itemsToDelete);
          setSelectedItems(new Set());
        } catch (error) {
          console.error("Error deleting items:", error);
          alert(error instanceof Error ? error.message : "Failed to delete items");
        }
      }
    );
  };

  const selectedCount = selectedItems.size;


  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Group categories by group
  const categoriesByGroup = new Map<string, SystemCategory[]>();
  categories.forEach((category) => {
    const groupCategories = categoriesByGroup.get(category.macroId) || [];
    groupCategories.push(category);
    categoriesByGroup.set(category.macroId, groupCategories);
  });

  // Group subcategories by category
  const subcategoriesByCategory = new Map<string, SystemSubcategory[]>();
  subcategories.forEach((subcategory) => {
    const categorySubcategories = subcategoriesByCategory.get(subcategory.categoryId) || [];
    categorySubcategories.push(subcategory);
    subcategoriesByCategory.set(subcategory.categoryId, categorySubcategories);
  });

  const totalItems = groups.length + categories.length + subcategories.length;

  return (
    <div className="hidden lg:block rounded-lg border overflow-x-auto">
      {selectedCount > 0 && onBulkDelete && (
        <div className="flex items-center justify-between p-4 bg-muted/50 border-b">
          <span className="text-sm text-muted-foreground">
            {selectedCount} item{selectedCount > 1 ? "s" : ""} selected
          </span>
          <Button
            variant="destructive"
            size="small"
            onClick={handleBulkDelete}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete Selected
          </Button>
        </div>
      )}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[50px]">
              {onBulkDelete && (
                <Checkbox
                  checked={allVisibleSelected}
                  onCheckedChange={handleSelectAll}
                  aria-label="Select all"
                />
              )}
            </TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Parent</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {totalItems === 0 ? (
            <TableRow>
              <TableCell colSpan={onBulkDelete ? 5 : 4} className="text-center py-8 text-muted-foreground">
                <div className="flex flex-col items-center gap-2">
                  <p>No entities found</p>
                </div>
              </TableCell>
            </TableRow>
          ) : (
            groups.map((group) => {
              const groupCategories = categoriesByGroup.get(group.id) || [];
              const isGroupExpanded = expanded.groups.has(group.id);

              return (
                <React.Fragment key={group.id}>
                  {/* Group Row */}
                  <TableRow className="bg-muted/50">
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {onBulkDelete && (
                          <Checkbox
                            checked={isSelected(group.id, "group")}
                            onCheckedChange={() => toggleSelection(group.id, "group")}
                            aria-label={`Select ${group.name}`}
                          />
                        )}
                        {groupCategories.length > 0 && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => toggleGroup(group.id)}
                          >
                            {isGroupExpanded ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </Button>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{group.name}</span>
                        <span className="text-xs text-muted-foreground">
                          ({groupCategories.length} categories)
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          group.type === "income"
                            ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                            : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                        }`}
                      >
                        {group.type === "income" ? "Income" : group.type === "expense" ? "Expense" : "N/A"}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">—</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => onEditGroup(group)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(group.id, "group", group.name)}
                          disabled={deletingId === group.id && deletingType === "group"}
                          className="h-8 w-8 text-destructive hover:text-destructive"
                        >
                          {deletingId === group.id && deletingType === "group" ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>

                  {/* Category Rows (shown when group is expanded) */}
                  {isGroupExpanded &&
                    groupCategories.map((category) => {
                      const categorySubcategories = subcategoriesByCategory.get(category.id) || [];
                      const isCategoryExpanded = expanded.categories.has(category.id);

                      return (
                        <React.Fragment key={category.id}>
                          <TableRow className="bg-background">
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {onBulkDelete && (
                                  <Checkbox
                                    checked={isSelected(category.id, "category")}
                                    onCheckedChange={() => toggleSelection(category.id, "category")}
                                    aria-label={`Select ${category.name}`}
                                  />
                                )}
                                <span className="w-4 text-xs font-semibold text-muted-foreground">
                                  {category.name.charAt(0).toUpperCase()}
                                </span>
                                {categorySubcategories.length > 0 && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6"
                                    onClick={() => toggleCategory(category.id)}
                                  >
                                    {isCategoryExpanded ? (
                                      <ChevronDown className="h-4 w-4" />
                                    ) : (
                                      <ChevronRight className="h-4 w-4" />
                                    )}
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="font-medium pl-8">
                              <div className="flex items-center gap-2">
                                <span>{category.name}</span>
                                <span className="text-xs text-muted-foreground">
                                  ({categorySubcategories.length} subcategories)
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>—</TableCell>
                            <TableCell className="text-muted-foreground">
                              {group.name}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-2">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => onEditCategory(category)}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleDelete(category.id, "category", category.name)}
                                  disabled={deletingId === category.id && deletingType === "category"}
                                  className="h-8 w-8 text-destructive hover:text-destructive"
                                >
                                  {deletingId === category.id && deletingType === "category" ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Trash2 className="h-4 w-4" />
                                  )}
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>

                          {/* Subcategory Rows (shown when category is expanded) */}
                          {isCategoryExpanded &&
                            categorySubcategories.map((subcategory) => (
                              <TableRow key={subcategory.id} className="bg-muted/30">
                                <TableCell>
                                  <div className="flex items-center gap-2 pl-4">
                                    {onBulkDelete && (
                                      <Checkbox
                                        checked={isSelected(subcategory.id, "subcategory")}
                                        onCheckedChange={() => toggleSelection(subcategory.id, "subcategory")}
                                        aria-label={`Select ${subcategory.name}`}
                                      />
                                    )}
                                    <span className="w-4 text-xs font-semibold text-muted-foreground">
                                      {subcategory.name.charAt(0).toUpperCase()}
                                    </span>
                                  </div>
                                </TableCell>
                                <TableCell className="font-medium pl-16">{subcategory.name}</TableCell>
                                <TableCell>—</TableCell>
                                <TableCell className="text-muted-foreground">
                                  {category.name}
                                </TableCell>
                                <TableCell className="text-right">
                                  <div className="flex items-center justify-end gap-2">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8"
                                      onClick={() => onEditSubcategory(subcategory)}
                                    >
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => handleDelete(subcategory.id, "subcategory", subcategory.name)}
                                      disabled={deletingId === subcategory.id && deletingType === "subcategory"}
                                      className="h-8 w-8 text-destructive hover:text-destructive"
                                    >
                                      {deletingId === subcategory.id && deletingType === "subcategory" ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                      ) : (
                                        <Trash2 className="h-4 w-4" />
                                      )}
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                        </React.Fragment>
                      );
                    })}
                </React.Fragment>
              );
            })
          )}
        </TableBody>
      </Table>
      {ConfirmDialog}
    </div>
  );
}

