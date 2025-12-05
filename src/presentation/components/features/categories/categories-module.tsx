"use client";

import React, { useState, useEffect, useMemo } from "react";
import { logger } from "@/src/infrastructure/utils/logger";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Edit, Trash2, ChevronRight, ChevronDown, X, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { CategoryDialog } from "@/components/categories/category-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/components/toast-provider";
import { useConfirmDialog } from "@/hooks/use-confirm-dialog";
import type { Category, Macro, BaseGroup } from "@/src/domain/categories/categories.types";
import { useWriteGuard } from "@/hooks/use-write-guard";
import { ChevronDown as ChevronDownIcon } from "lucide-react";

interface Subcategory {
  id: string;
  name: string;
  categoryId: string;
  userId?: string | null;
  logo?: string | null;
}

interface GroupedData {
  macro: Macro;
  categories: Category[];
}

export function CategoriesModule() {
  const { toast } = useToast();
  const { checkWriteAccess, canWrite } = useWriteGuard();
  const { openDialog: openDeleteCategoryDialog, ConfirmDialog: DeleteCategoryConfirmDialog } = useConfirmDialog();
  const { openDialog: openDeleteSubcategoryDialog, ConfirmDialog: DeleteSubcategoryConfirmDialog } = useConfirmDialog();
  const [categories, setCategories] = useState<Category[]>([]);
  const [macros, setMacros] = useState<Macro[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [deletingCategoryId, setDeletingCategoryId] = useState<string | null>(null);
  const [deletingSubcategoryId, setDeletingSubcategoryId] = useState<string | null>(null);

  useEffect(() => {
    loadData();
    loadCurrentUser();
  }, []);

  async function loadCurrentUser() {
    try {
      const response = await fetch("/api/v2/user");
      if (!response.ok) {
        throw new Error("Failed to fetch user data");
      }
      const data = await response.json();
      if (data.user) {
        setCurrentUserId(data.user?.id || null);
      }
    } catch (error) {
      logger.error("Error loading current user:", error);
    }
  }

  async function loadData(forceRefresh = false) {
    try {
      // OPTIMIZED: Single API call to get both groups and categories using v2 API route
      // Add cache-busting parameter if forceRefresh is true
      const url = forceRefresh 
        ? `/api/v2/categories?consolidated=true&_t=${Date.now()}`
        : "/api/v2/categories?consolidated=true";
      
      const response = await fetch(url, {
        cache: forceRefresh ? 'no-store' : 'default',
      });
      if (!response.ok) {
        throw new Error("Failed to fetch categories data");
      }
      const { groups, categories: allCategories } = await response.json();
      
      setCategories(allCategories || []);
      setMacros(groups || []);
    } catch (error) {
      logger.error("Error loading data:", error);
    }
  }

  // Group categories by macro, separated by system and user categories
  const { systemGroups, userGroups } = useMemo(() => {
    const systemGroupsMap = new Map<string, GroupedData>();
    const userGroupsMap = new Map<string, GroupedData>();
    
    // Remove duplicate categories by ID (keep first occurrence)
    const uniqueCategories = Array.from(
      new Map(categories.map((cat) => [cat.id, cat])).values()
    );
    
    // Separate system and user categories
    // System categories: userId === null
    // User categories: userId !== null AND userId === currentUserId (to ensure only current user's categories)
    const systemCategories = uniqueCategories.filter((cat) => cat.userId === null);
    const userCategories = uniqueCategories.filter((cat) => 
      cat.userId !== null && (currentUserId ? cat.userId === currentUserId : false)
    );
    
    // Filter subcategories to only show those belonging to user-created categories
    const userCategoriesWithFilteredSubcategories = userCategories.map((category) => ({
      ...category,
      subcategories: category.subcategories?.filter((subcat) => {
        // Subcategories don't have userId, so we filter by parent category
        // Only show subcategories that belong to user-created categories
        return category.userId !== null && category.userId === currentUserId;
      }),
    }));
    
    // Initialize all macros for system categories
    macros.forEach((macro) => {
      systemGroupsMap.set(macro.id, {
        macro,
        categories: [],
      });
    });
    
    // For user groups, only initialize system macros that have at least one user-created category
    // Users cannot create groups, so all groups are system groups (userId IS NULL)
    const userMacroIds = new Set<string>();
    
    // Add system macros that have at least one user-created category
    userCategoriesWithFilteredSubcategories.forEach((category) => {
      const macroId = category.groupId;
      if (!macroId) return;
      if (!userMacroIds.has(macroId)) {
        // Find the macro (must be a system macro since users can't create groups)
        const macro = macros.find((m) => m.id === macroId);
        if (macro) {
          userMacroIds.add(macroId);
          userGroupsMap.set(macroId, {
            macro,
            categories: [],
          });
        }
      }
    });
    
    // Add system categories to their respective groups
    systemCategories.forEach((category) => {
      const macroId = category.groupId;
      if (!macroId) return;
      const group = systemGroupsMap.get(macroId);
      if (group) {
        if (!group.categories.some((c) => c.id === category.id)) {
          group.categories.push(category);
        }
      } else {
        const fallbackGroup: BaseGroup = { id: macroId, name: "Unknown", type: null };
        const group: BaseGroup = (category.group && 'type' in category.group && category.group.type !== undefined)
          ? { id: category.group.id, name: category.group.name, type: category.group.type as "income" | "expense" | null }
          : fallbackGroup;
        systemGroupsMap.set(macroId, {
          macro: group,
          categories: [category],
        });
      }
    });
    
    // Add user categories to their respective groups (only groups that exist in userGroupsMap)
    userCategoriesWithFilteredSubcategories.forEach((category) => {
      const macroId = category.groupId;
      if (!macroId) return;
      const group = userGroupsMap.get(macroId);
      if (group) {
        if (!group.categories.some((c) => c.id === category.id)) {
          group.categories.push(category);
        }
      }
    });
    
    // Sort categories within each group
    systemGroupsMap.forEach((group) => {
      group.categories.sort((a, b) => a.name.localeCompare(b.name));
    });
    userGroupsMap.forEach((group) => {
      group.categories.sort((a, b) => a.name.localeCompare(b.name));
    });
    
    // Sort by macro name
    const systemGroupsArray = Array.from(systemGroupsMap.values())
      .sort((a, b) => a.macro.name.localeCompare(b.macro.name));
    
    // Only include groups that have at least one category (user-created)
    const userGroupsArray = Array.from(userGroupsMap.values())
      .filter((group) => group.categories.length > 0)
      .sort((a, b) => a.macro.name.localeCompare(b.macro.name));
    
    return {
      systemGroups: systemGroupsArray,
      userGroups: userGroupsArray,
    };
  }, [categories, macros, currentUserId]);

  function toggleGroup(macroId: string) {
    setExpandedGroups((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(macroId)) {
        newSet.delete(macroId);
      } else {
        newSet.add(macroId);
      }
      return newSet;
    });
  }

  function handleDeleteCategory(id: string) {
    if (!checkWriteAccess()) return;
    openDeleteCategoryDialog(
      {
        title: "Delete Category",
        description: "Are you sure you want to delete this category? This will also delete all associated subcategories.",
        variant: "destructive",
        confirmLabel: "Delete",
      },
      async () => {
        const categoryToDelete = categories.find(c => c.id === id);
        
        // Optimistic update: remove from UI immediately
        setCategories(prev => prev.filter(c => c.id !== id));
        setDeletingCategoryId(id);

        try {
          const response = await fetch(`/api/v2/categories/${id}`, {
            method: "DELETE",
          });

          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || "Failed to delete category");
          }
          
          toast({
            title: "Category deleted",
            description: "Your category has been deleted successfully.",
            variant: "success",
          });
          
          loadData();
        } catch (error) {
          logger.error("Error deleting category:", error);
          // Revert optimistic update on error
          if (categoryToDelete) {
            setCategories(prev => [...prev, categoryToDelete]);
          }
          const errorMessage = error instanceof Error ? error.message : "Failed to delete category";
          toast({
            title: "Error",
            description: errorMessage,
            variant: "destructive",
          });
        } finally {
          setDeletingCategoryId(null);
        }
      }
    );
  }

  function handleDeleteSubcategory(id: string) {
    if (!checkWriteAccess()) return;
    openDeleteSubcategoryDialog(
      {
        title: "Delete Subcategory",
        description: "Are you sure you want to delete this subcategory?",
        variant: "destructive",
        confirmLabel: "Delete",
      },
      async () => {
        setDeletingSubcategoryId(id);
        try {
          const response = await fetch(`/api/v2/categories/subcategories/${id}`, {
            method: "DELETE",
          });

          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || "Failed to delete subcategory");
          }
          
          toast({
            title: "Subcategory deleted",
            description: "Your subcategory has been deleted successfully.",
            variant: "success",
          });
          
          loadData();
        } catch (error) {
          logger.error("Error deleting subcategory:", error);
          const errorMessage = error instanceof Error ? error.message : "Failed to delete subcategory";
          toast({
            title: "Error",
            description: errorMessage,
            variant: "destructive",
          });
        } finally {
          setDeletingSubcategoryId(null);
        }
      }
    );
  }


  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg sm:text-xl md:text-2xl font-bold">Categories</h2>
          <p className="text-xs sm:text-sm md:text-base text-muted-foreground mt-1">
            Manage your transaction categories and groups
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="medium" className="cursor-pointer">
              Create New
              <ChevronDownIcon className="ml-2 h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={() => {
                if (!checkWriteAccess()) return;
                setSelectedCategory(null);
                setIsDialogOpen(true);
              }}
            >
              Create Category
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="w-full">
        {/* Custom Categories Section */}
          {userGroups.length > 0 ? (
            <>
              {/* Mobile/Tablet Card View */}
              <div className="lg:hidden space-y-4">
                {userGroups.map((group) => {
                  const isExpanded = expandedGroups.has(group.macro.id);
                  return (
                    <Card key={`user-mobile-${group.macro.id}`}>
                      <CardContent className="p-4">
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 flex-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => toggleGroup(group.macro.id)}
                              >
                                {isExpanded ? (
                                  <ChevronDown className="h-4 w-4" />
                                ) : (
                                  <ChevronRight className="h-4 w-4" />
                                )}
                              </Button>
                              <div className="flex-1">
                                <h3 className="font-semibold text-sm">{group.macro.name}</h3>
                                <p className="text-xs text-muted-foreground">
                                  {group.categories.length} {group.categories.length === 1 ? "category" : "categories"} • {" "}
                                  {group.categories.reduce((sum, cat) => sum + (cat.subcategories?.length || 0), 0)}{" "}
                                  {group.categories.reduce((sum, cat) => sum + (cat.subcategories?.length || 0), 0) === 1
                                    ? "subcategory"
                                    : "subcategories"}
                                </p>
                              </div>
                            </div>
                          </div>
                          
                          {isExpanded && (
                            <div className="space-y-3 pt-2 border-t">
                              {group.categories.map((category) => (
                                <div key={category.id} className="space-y-2">
                                  <div className="flex items-center justify-between">
                                    <h4 className="font-medium text-sm">{category.name}</h4>
                                    {canWrite && (
                                      <div className="flex gap-1">
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-8 w-8"
                                          onClick={() => {
                                            if (!checkWriteAccess()) return;
                                            setSelectedCategory(category);
                                            setIsDialogOpen(true);
                                          }}
                                          title="Edit category"
                                        >
                                          <Edit className="h-4 w-4" />
                                        </Button>
                                        {category.userId !== null && (currentUserId ? category.userId === currentUserId : false) && (
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8"
                                            onClick={() => {
                                              if (!checkWriteAccess()) return;
                                              handleDeleteCategory(category.id);
                                            }}
                                            title="Delete category"
                                            disabled={deletingCategoryId === category.id}
                                          >
                                            {deletingCategoryId === category.id ? (
                                              <Loader2 className="h-4 w-4 animate-spin" />
                                            ) : (
                                              <Trash2 className="h-4 w-4" />
                                            )}
                                          </Button>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                  {category.subcategories && category.subcategories.length > 0 && (
                                    <div className="flex flex-wrap gap-1.5">
                                      {category.subcategories.map((subcat) => (
                                        <div
                                          key={subcat.id}
                                          className="group relative inline-flex items-center gap-1"
                                        >
                                          <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs bg-muted text-muted-foreground">
                                            {subcat.logo && (
                                              <img 
                                                src={subcat.logo} 
                                                alt={subcat.name}
                                                className="h-3 w-3 object-contain rounded"
                                                onError={(e) => {
                                                  (e.target as HTMLImageElement).style.display = 'none';
                                                }}
                                              />
                                            )}
                                            {subcat.name}
                                          </span>
                                          {category.userId !== null && category.userId !== undefined && currentUserId && category.userId === currentUserId && (
                                            <Button
                                              variant="ghost"
                                              size="icon"
                                              className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
                                              onClick={() => {
                                                if (!checkWriteAccess()) return;
                                                handleDeleteSubcategory(subcat.id);
                                              }}
                                              title="Delete subcategory"
                                              disabled={deletingSubcategoryId === subcat.id}
                                            >
                                              {deletingSubcategoryId === subcat.id ? (
                                                <Loader2 className="h-3 w-3 animate-spin text-destructive" />
                                              ) : (
                                                <X className="h-3 w-3 text-destructive" />
                                              )}
                                            </Button>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              {/* Desktop Table View */}
              <div className="hidden lg:block rounded-lg border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs md:text-sm w-[50px]"></TableHead>
                      <TableHead className="text-xs md:text-sm">Group</TableHead>
                      <TableHead className="text-xs md:text-sm">Category</TableHead>
                      <TableHead className="text-xs md:text-sm">Subcategories</TableHead>
                      <TableHead className="text-xs md:text-sm">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {userGroups.map((group) => {
                      const isExpanded = expandedGroups.has(group.macro.id);
                      
                      return (
                        <React.Fragment key={`user-${group.macro.id}`}>
                          {/* Group header row */}
                          <TableRow className="bg-muted/30 hover:bg-muted/50">
                            <TableCell className="w-[50px]">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 md:h-8 md:w-8"
                                onClick={() => toggleGroup(group.macro.id)}
                              >
                                {isExpanded ? (
                                  <ChevronDown className="h-4 w-4" />
                                ) : (
                                  <ChevronRight className="h-4 w-4" />
                                )}
                              </Button>
                            </TableCell>
                            <TableCell className="text-xs md:text-sm font-semibold">
                              {group.macro.name}
                            </TableCell>
                            <TableCell className="text-xs md:text-sm text-muted-foreground">
                              {group.categories.length} {group.categories.length === 1 ? "category" : "categories"}
                            </TableCell>
                            <TableCell className="text-xs md:text-sm text-muted-foreground">
                              {group.categories.reduce((sum, cat) => sum + (cat.subcategories?.length || 0), 0)}{" "}
                              {group.categories.reduce((sum, cat) => sum + (cat.subcategories?.length || 0), 0) === 1
                                ? "subcategory"
                                : "subcategories"}
                            </TableCell>
                            <TableCell></TableCell>
                          </TableRow>
                          
                          {/* Categories rows (shown when expanded) */}
                          {isExpanded &&
                            group.categories.map((category) => (
                              <React.Fragment key={category.id}>
                                {/* Category row */}
                                <TableRow className="bg-background">
                                  <TableCell></TableCell>
                                  <TableCell></TableCell>
                                  <TableCell className="text-xs md:text-sm font-medium pl-6 md:pl-8">
                                    {category.name}
                                  </TableCell>
                                  <TableCell className="text-xs md:text-sm">
                                    {category.subcategories && category.subcategories.length > 0 ? (
                                      <div className="flex flex-wrap gap-1">
                                        {category.subcategories.map((subcat) => (
                                          <div
                                            key={subcat.id}
                                            className="group relative inline-flex items-center gap-1"
                                          >
                                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs bg-muted text-muted-foreground">
                                              {subcat.logo && (
                                                <img 
                                                  src={subcat.logo} 
                                                  alt={subcat.name}
                                                  className="h-3 w-3 object-contain rounded"
                                                  onError={(e) => {
                                                    (e.target as HTMLImageElement).style.display = 'none';
                                                  }}
                                                />
                                              )}
                                              {subcat.name}
                                            </span>
                                            {/* Only show delete button for user-created subcategories */}
                                            {category.userId !== null && category.userId !== undefined && currentUserId && category.userId === currentUserId && (
                                              <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
                                                onClick={() => {
                                                  if (!checkWriteAccess()) return;
                                                  handleDeleteSubcategory(subcat.id);
                                                }}
                                                title="Delete subcategory"
                                                disabled={deletingSubcategoryId === subcat.id}
                                              >
                                                {deletingSubcategoryId === subcat.id ? (
                                                  <Loader2 className="h-3 w-3 animate-spin text-destructive" />
                                                ) : (
                                                  <X className="h-3 w-3 text-destructive" />
                                                )}
                                              </Button>
                                            )}
                                          </div>
                                        ))}
                                      </div>
                                    ) : (
                                      <span className="text-muted-foreground">-</span>
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    {canWrite && (
                                      <div className="flex space-x-1 md:space-x-2">
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-7 w-7 md:h-10 md:w-10"
                                          onClick={() => {
                                            if (!checkWriteAccess()) return;
                                            setSelectedCategory(category);
                                            setIsDialogOpen(true);
                                          }}
                                          title="Edit category"
                                        >
                                          <Edit className="h-3 w-3 md:h-4 md:w-4" />
                                        </Button>
                                        {category.userId !== null && (currentUserId ? category.userId === currentUserId : false) && (
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-7 w-7 md:h-10 md:w-10"
                                            onClick={() => {
                                              if (!checkWriteAccess()) return;
                                              handleDeleteCategory(category.id);
                                            }}
                                            title="Delete category"
                                            disabled={deletingCategoryId === category.id}
                                          >
                                            {deletingCategoryId === category.id ? (
                                              <Loader2 className="h-3 w-3 md:h-4 md:w-4 animate-spin" />
                                            ) : (
                                              <Trash2 className="h-3 w-3 md:h-4 md:w-4" />
                                            )}
                                          </Button>
                                        )}
                                      </div>
                                    )}
                                  </TableCell>
                                </TableRow>
                              </React.Fragment>
                            ))}
                          
                        </React.Fragment>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </>
          ) : (
            <div className="rounded-lg border p-12">
              <div className="text-center">
                <p className="text-sm text-muted-foreground">
                  No custom categories found
                </p>
              </div>
            </div>
          )}

      <CategoryDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        category={selectedCategory}
        macros={macros}
        onSuccess={(updatedCategory) => {
          if (updatedCategory) {
            // Update state locally without reloading - use functional update to preserve references
            setCategories((prev) => {
              // Check if category already exists
              const existingIndex = prev.findIndex((c) => c.id === updatedCategory.id);
              if (existingIndex >= 0) {
                // Check if category actually changed to avoid unnecessary re-renders
                const existing = prev[existingIndex];
                
                // Compare subcategories more efficiently
                const subcategoriesChanged = 
                  (existing.subcategories?.length || 0) !== (updatedCategory.subcategories?.length || 0) ||
                  (existing.subcategories || []).some((sub, idx) => {
                    const updatedSub = updatedCategory.subcategories?.[idx];
                    return !updatedSub || sub.id !== updatedSub.id || sub.name !== updatedSub.name;
                  });
                
                const hasChanged = 
                  existing.name !== updatedCategory.name ||
                  existing.groupId !== updatedCategory.groupId ||
                  subcategoriesChanged;
                
                if (!hasChanged) {
                  // No changes, return same array to prevent re-render
                  return prev;
                }
                
                // Update existing category - create new array but preserve other references
                const updated = prev.map((cat, idx) => 
                  idx === existingIndex ? updatedCategory : cat
                );
                return updated;
              } else {
                // Add new category - append to existing array
                return [...prev, updatedCategory];
              }
            });
            
            // If macro doesn't exist in macros list, fetch it
            if (updatedCategory.groupId && !macros.find((m) => m.id === updatedCategory.groupId)) {
              loadData(); // Only reload if macro is missing
            }
          } else {
            // Fallback: reload all data if no category provided
            loadData();
          }
        }}
      />
      {DeleteCategoryConfirmDialog}
      {DeleteSubcategoryConfirmDialog}
      </div>
    </div>
  );
}

