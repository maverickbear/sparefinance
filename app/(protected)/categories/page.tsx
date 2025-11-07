"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Edit, Trash2, ChevronRight, ChevronDown, X } from "lucide-react";
import { CategoryDialog } from "@/components/categories/category-dialog";
import { GroupDialog } from "@/components/categories/group-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/components/toast-provider";
import type { Category, Macro } from "@/lib/api/categories-client";

interface Subcategory {
  id: string;
  name: string;
  categoryId: string;
  userId?: string | null;
}

interface GroupedData {
  macro: Macro;
  categories: Category[];
}

export default function CategoriesPage() {
  const { toast } = useToast();
  const [categories, setCategories] = useState<Category[]>([]);
  const [macros, setMacros] = useState<Macro[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isGroupDialogOpen, setIsGroupDialogOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    loadData();
    loadCurrentUser();
  }, []);

  async function loadCurrentUser() {
    try {
      const { getUserClient } = await import("@/lib/api/user-client");
      const data = await getUserClient();
      if (data.user) {
        setCurrentUserId(data.user?.id || null);
      }
    } catch (error) {
      console.error("Error loading current user:", error);
    }
  }

  async function loadData() {
    try {
      const { getAllCategoriesClient, getMacrosClient } = await import("@/lib/api/categories-client");
      const [allCategories, macrosData] = await Promise.all([
        getAllCategoriesClient(),
        getMacrosClient(),
      ]);
      
      setCategories(allCategories);
      setMacros(macrosData);
    } catch (error) {
      console.error("Error loading data:", error);
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
    
    // For user groups, only initialize macros that:
    // 1. Are created by the user (userId !== null && userId === currentUserId), OR
    // 2. Have at least one category created by the user
    const userMacroIds = new Set<string>();
    
    // Add macros created by the user
    macros
      .filter((macro) => macro.userId !== null && (currentUserId ? macro.userId === currentUserId : false))
      .forEach((macro) => {
        userMacroIds.add(macro.id);
        userGroupsMap.set(macro.id, {
          macro,
          categories: [],
        });
      });
    
    // Add macros that have at least one user-created category
    userCategoriesWithFilteredSubcategories.forEach((category) => {
      const macroId = category.macroId;
      if (!macroId) return;
      if (!userMacroIds.has(macroId)) {
        // Find the macro (could be system macro or user macro)
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
      const macroId = category.macroId;
      if (!macroId) return;
      const group = systemGroupsMap.get(macroId);
      if (group) {
        if (!group.categories.some((c) => c.id === category.id)) {
          group.categories.push(category);
        }
      } else {
        systemGroupsMap.set(macroId, {
          macro: category.macro || { id: macroId, name: "Unknown" },
          categories: [category],
        });
      }
    });
    
    // Add user categories to their respective groups (only groups that exist in userGroupsMap)
    userCategoriesWithFilteredSubcategories.forEach((category) => {
      const macroId = category.macroId;
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

  async function handleDeleteCategory(id: string) {
    if (!confirm("Are you sure you want to delete this category? This will also delete all associated subcategories.")) return;

    const categoryToDelete = categories.find(c => c.id === id);
    
    // Optimistic update: remove from UI immediately
    setCategories(prev => prev.filter(c => c.id !== id));

    try {
      const { deleteCategoryClient } = await import("@/lib/api/categories-client");
      await deleteCategoryClient(id);
      
      toast({
        title: "Category deleted",
        description: "Your category has been deleted successfully.",
        variant: "success",
      });
      
      loadData();
    } catch (error) {
      console.error("Error deleting category:", error);
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
    }
  }

  async function handleDeleteSubcategory(id: string) {
    if (!confirm("Are you sure you want to delete this subcategory?")) return;

    try {
      const { deleteSubcategoryClient } = await import("@/lib/api/categories-client");
      await deleteSubcategoryClient(id);
      
      toast({
        title: "Subcategory deleted",
        description: "Your subcategory has been deleted successfully.",
        variant: "success",
      });
      
      loadData();
    } catch (error) {
      console.error("Error deleting subcategory:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to delete subcategory";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    }
  }

  async function handleDeleteGroup(macroId: string) {
    if (!confirm("Are you sure you want to delete this group? This will also delete all associated categories and subcategories.")) return;

    const groupToDelete = macros.find(m => m.id === macroId);
    
    // Optimistic update: remove from UI immediately
    setMacros(prev => prev.filter(m => m.id !== macroId));

    try {
      const { deleteMacroClient } = await import("@/lib/api/categories-client");
      await deleteMacroClient(macroId);
      
      toast({
        title: "Group deleted",
        description: "Your group has been deleted successfully.",
        variant: "success",
      });
      
      loadData();
    } catch (error) {
      console.error("Error deleting group:", error);
      // Revert optimistic update on error
      if (groupToDelete) {
        setMacros(prev => [...prev, groupToDelete]);
      }
      const errorMessage = error instanceof Error ? error.message : "Failed to delete group";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    }
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Categories</h1>
          <p className="text-sm md:text-base text-muted-foreground">Manage your categories and subcategories</p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" className="cursor-pointer">
              Create New
              <ChevronDown className="ml-2 h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={() => {
                setIsGroupDialogOpen(true);
              }}
            >
              Create Group
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                setSelectedCategory(null);
                setIsDialogOpen(true);
              }}
            >
              Create Category
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="space-y-6">
        {/* System Categories Section */}
        {systemGroups.length > 0 && (
          <div className="space-y-2">
            <h2 className="text-lg font-semibold text-muted-foreground">System Categories</h2>
            <div className="rounded-[12px] border overflow-x-auto">
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
                  {systemGroups.map((group) => {
                    const isExpanded = expandedGroups.has(group.macro.id);
                    const hasCategories = group.categories.length > 0;
                    
                    return (
                      <React.Fragment key={`system-${group.macro.id}`}>
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
                                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs bg-muted text-muted-foreground">
                                            {subcat.name}
                                          </span>
                                          {/* Only show delete button for user-created subcategories */}
                                          {category.userId !== null && category.userId !== undefined && currentUserId && category.userId === currentUserId && (
                                            <Button
                                              variant="ghost"
                                              size="icon"
                                              className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
                                              onClick={() => handleDeleteSubcategory(subcat.id)}
                                              title="Delete subcategory"
                                            >
                                              <X className="h-3 w-3 text-destructive" />
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
                                  <div className="flex space-x-1 md:space-x-2">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7 md:h-10 md:w-10"
                                      onClick={() => {
                                        setSelectedCategory(category);
                                        setIsDialogOpen(true);
                                      }}
                                      title="Edit category (add subcategories)"
                                    >
                                      <Edit className="h-3 w-3 md:h-4 md:w-4" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            </React.Fragment>
                          ))}
                        
                        {/* Empty state for group */}
                        {isExpanded && !hasCategories && (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-4">
                              No categories in this group
                            </TableCell>
                          </TableRow>
                        )}
                      </React.Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        {/* User Categories Section */}
        {userGroups.length > 0 && (
          <div className="space-y-2">
            <h2 className="text-lg font-semibold">My Categories</h2>
            <div className="rounded-[12px] border overflow-x-auto">
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
                    const hasCategories = group.categories.length > 0;
                    
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
                          <TableCell>
                            {group.macro.userId !== null && (currentUserId ? group.macro.userId === currentUserId : false) && (
                              <div className="flex space-x-1 md:space-x-2">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 md:h-10 md:w-10"
                                  onClick={() => handleDeleteGroup(group.macro.id)}
                                  title="Delete group"
                                >
                                  <Trash2 className="h-3 w-3 md:h-4 md:w-4" />
                                </Button>
                              </div>
                            )}
                          </TableCell>
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
                                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs bg-muted text-muted-foreground">
                                            {subcat.name}
                                          </span>
                                          {/* Only show delete button for user-created subcategories */}
                                          {category.userId !== null && category.userId !== undefined && currentUserId && category.userId === currentUserId && (
                                            <Button
                                              variant="ghost"
                                              size="icon"
                                              className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
                                              onClick={() => handleDeleteSubcategory(subcat.id)}
                                              title="Delete subcategory"
                                            >
                                              <X className="h-3 w-3 text-destructive" />
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
                                  <div className="flex space-x-1 md:space-x-2">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7 md:h-10 md:w-10"
                                      onClick={() => {
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
                                        onClick={() => handleDeleteCategory(category.id)}
                                        title="Delete category"
                                      >
                                        <Trash2 className="h-3 w-3 md:h-4 md:w-4" />
                                      </Button>
                                    )}
                                  </div>
                                </TableCell>
                              </TableRow>
                            </React.Fragment>
                          ))}
                        
                        {/* Empty state for group */}
                        {isExpanded && !hasCategories && (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-4">
                              No categories in this group
                            </TableCell>
                          </TableRow>
                        )}
                      </React.Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        {/* Empty state when no categories */}
        {systemGroups.length === 0 && userGroups.length === 0 && (
          <div className="rounded-[12px] border p-8 text-center">
            <p className="text-sm text-muted-foreground">No categories found</p>
          </div>
        )}
      </div>

      <CategoryDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        category={selectedCategory}
        macros={macros}
        onSuccess={loadData}
      />
      <GroupDialog
        open={isGroupDialogOpen}
        onOpenChange={setIsGroupDialogOpen}
        onSuccess={loadData}
      />
    </div>
  );
}

