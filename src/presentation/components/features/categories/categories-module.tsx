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
import { useToast } from "@/components/toast-provider";
import { useConfirmDialog } from "@/hooks/use-confirm-dialog";
import type { Category } from "@/src/domain/categories/categories.types";
import { useWriteGuard } from "@/hooks/use-write-guard";

interface Subcategory {
  id: string;
  name: string;
  categoryId: string;
  userId?: string | null;
  logo?: string | null;
}


interface CategoriesModuleProps {
  isCreateDialogOpen?: boolean;
  onCreateDialogChange?: (open: boolean) => void;
}

export function CategoriesModule({ 
  isCreateDialogOpen: externalIsCreateDialogOpen,
  onCreateDialogChange: externalOnCreateDialogChange 
}: CategoriesModuleProps = {}) {
  const { toast } = useToast();
  const { checkWriteAccess, canWrite } = useWriteGuard();
  const { openDialog: openDeleteCategoryDialog, ConfirmDialog: DeleteCategoryConfirmDialog } = useConfirmDialog();
  const { openDialog: openDeleteSubcategoryDialog, ConfirmDialog: DeleteSubcategoryConfirmDialog } = useConfirmDialog();
  const [categories, setCategories] = useState<Category[]>([]);
  const [internalIsDialogOpen, setInternalIsDialogOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  
  // Use external dialog state if provided, otherwise use internal
  const isDialogOpen = externalIsCreateDialogOpen !== undefined ? externalIsCreateDialogOpen : internalIsDialogOpen;
  const setIsDialogOpen = externalOnCreateDialogChange || setInternalIsDialogOpen;
  
  // When dialog opens externally (from header), ensure selectedCategory is null
  useEffect(() => {
    if (externalIsCreateDialogOpen && externalIsCreateDialogOpen === true && selectedCategory !== null) {
      setSelectedCategory(null);
    }
  }, [externalIsCreateDialogOpen, selectedCategory]);
  
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
      // Use cachedFetch to respect Cache-Control headers from server
      const { cachedFetch } = await import("@/lib/utils/cached-fetch");
      const allCategories = await cachedFetch<Category[]>(
        "/api/v2/categories?all=true",
        {
          forceRefresh,
        }
      );
      
      setCategories(allCategories || []);
    } catch (error) {
      logger.error("Error loading data:", error);
    }
  }

  // Separate system and user categories
  const { systemCategories, userCategories } = useMemo(() => {
    // Remove duplicate categories by ID (keep first occurrence)
    const uniqueCategories = Array.from(
      new Map(categories.map((cat) => [cat.id, cat])).values()
    );
    
    // Separate system and user categories
    // System categories: isSystem === true
    // User categories: isSystem === false AND userId === currentUserId (to ensure only current user's categories)
    const system = uniqueCategories
      .filter((cat) => cat.isSystem === true)
      .sort((a, b) => a.name.localeCompare(b.name));
    
    const user = uniqueCategories
      .filter((cat) => 
        cat.userId !== null && (currentUserId ? cat.userId === currentUserId : false)
      )
      .map((category) => ({
        ...category,
        subcategories: category.subcategories?.filter((subcat) => {
          // Subcategories don't have userId, so we filter by parent category
          // Only show subcategories that belong to user-created categories
          return category.userId !== null && category.userId === currentUserId;
        }),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
    
    return {
      systemCategories: system,
      userCategories: user,
    };
  }, [categories, currentUserId]);

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
      <div className="w-full">
        {/* Custom Categories Section */}
          {userCategories.length > 0 ? (
            <>
              {/* Mobile/Tablet Card View */}
              <div className="lg:hidden space-y-4">
                {userCategories.map((category) => (
                  <Card key={`user-mobile-${category.id}`}>
                    <CardContent className="p-4">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 flex-1">
                            <div className="flex-1">
                              <h3 className="font-semibold text-sm">{category.name}</h3>
                              {category.subcategories && category.subcategories.length > 0 && (
                                <p className="text-xs text-muted-foreground">
                                  {category.subcategories.length} {category.subcategories.length === 1 ? "subcategory" : "subcategories"}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                        
                        <div className="space-y-3 pt-2 border-t">
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
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
              </div>

              {/* Desktop Table View */}
              <div className="hidden lg:block rounded-lg border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs md:text-sm">Category</TableHead>
                      <TableHead className="text-xs md:text-sm">Subcategories</TableHead>
                      <TableHead className="text-xs md:text-sm">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {userCategories.map((category) => (
                      <TableRow key={category.id} className="bg-background">
                        <TableCell className="text-xs md:text-sm font-medium">
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
                    ))}
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
        onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) {
            setSelectedCategory(null);
          }
        }}
        category={selectedCategory}
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

