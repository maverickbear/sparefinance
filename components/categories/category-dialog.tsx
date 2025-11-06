"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { categorySchema, CategoryFormData, subcategorySchema, SubcategoryFormData } from "@/lib/validations/category";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useState, useEffect } from "react";
import { Plus, Edit, X, Check } from "lucide-react";
import { useToast } from "@/components/toast-provider";

interface Macro {
  id: string;
  name: string;
}

interface Subcategory {
  id: string;
  name: string;
  categoryId: string;
  userId?: string | null;
}

interface PendingSubcategory {
  name: string;
  tempId: string;
}

interface Category {
  id: string;
  name: string;
  macroId: string;
  userId?: string | null;
  subcategories?: Subcategory[];
}

interface CategoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category?: Category | null;
  macros: Macro[];
  onSuccess?: () => void;
}

export function CategoryDialog({
  open,
  onOpenChange,
  category,
  macros,
  onSuccess,
}: CategoryDialogProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [subcategories, setSubcategories] = useState<Subcategory[]>(category?.subcategories || []);
  const [pendingSubcategories, setPendingSubcategories] = useState<PendingSubcategory[]>([]);
  const [editingSubcategoryId, setEditingSubcategoryId] = useState<string | null>(null);
  const [editingPendingSubcategoryTempId, setEditingPendingSubcategoryTempId] = useState<string | null>(null);
  const [editingSubcategoryName, setEditingSubcategoryName] = useState("");
  const [newSubcategoryName, setNewSubcategoryName] = useState("");
  const [isAddingSubcategory, setIsAddingSubcategory] = useState(false);
  const [isSubmittingSubcategory, setIsSubmittingSubcategory] = useState(false);
  const [currentCategoryId, setCurrentCategoryId] = useState<string | null>(category?.id || null);
  
  // Check if this is a system category (userId === null)
  const isSystemCategory = category?.userId === null || category?.userId === undefined;

  const form = useForm<CategoryFormData>({
    resolver: zodResolver(categorySchema),
    defaultValues: category
      ? {
          name: category.name,
          macroId: category.macroId,
        }
      : {
          name: "",
          macroId: "",
        },
  });

  // Reset form and subcategories when dialog opens/closes or category changes
  useEffect(() => {
    if (open) {
      form.reset(
        category
          ? {
              name: category.name,
              macroId: category.macroId,
            }
          : {
              name: "",
              macroId: "",
            }
      );
      setSubcategories(category?.subcategories || []);
      setPendingSubcategories([]);
      setCurrentCategoryId(category?.id || null);
      setEditingSubcategoryId(null);
      setEditingPendingSubcategoryTempId(null);
      setEditingSubcategoryName("");
      setNewSubcategoryName("");
      setIsAddingSubcategory(false);
    }
  }, [open, category, form]);

  async function onSubmit(data: CategoryFormData) {
    try {
      setIsSubmitting(true);
      
      // For system categories, skip the category update and just refresh subcategories
      if (isSystemCategory && category) {
        // Refresh the subcategories list and close dialog
        const res = await fetch(`/api/categories/all`);
        if (res.ok) {
          const allCategories = await res.json();
          const updatedCategory = allCategories.find((cat: any) => cat.id === category.id);
          if (updatedCategory) {
            setSubcategories(updatedCategory.subcategories || []);
          }
        }
        // Close dialog and reload data
        onSuccess?.();
        onOpenChange(false);
        return;
      }
      
      const url = category ? `/api/categories/${category.id}` : "/api/categories";
      const method = category ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to save category");
      }

      const savedCategory = await res.json();
      setCurrentCategoryId(savedCategory.id);
      
      // If this is a new category with pending subcategories, create them all
      if (!category && pendingSubcategories.length > 0) {
        try {
          const subcategoryPromises = pendingSubcategories.map((pending) =>
            fetch(`/api/categories/${savedCategory.id}/subcategories`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ name: pending.name }),
            }).then((res) => {
              if (!res.ok) {
                throw new Error(`Failed to create subcategory: ${pending.name}`);
              }
              return res.json();
            })
          );

          const createdSubcategories = await Promise.all(subcategoryPromises);
          setSubcategories(createdSubcategories);
          setPendingSubcategories([]);
        } catch (error) {
          console.error("Error creating subcategories:", error);
          toast({
            title: "Partial Success",
            description: "Category created but some subcategories failed to create. Please add them manually.",
            variant: "destructive",
          });
        }
      } else {
        setSubcategories(savedCategory.subcategories || []);
      }

      // Only close dialog and reload if editing existing category
      if (category) {
        onSuccess?.();
        onOpenChange(false);
        form.reset();
      }
      // For new categories, keep dialog open to allow adding more subcategories
      toast({
        title: category ? "Category updated" : "Category created",
        description: category ? "Your category has been updated successfully." : "Your category has been created successfully.",
        variant: "success",
      });
    } catch (error) {
      console.error("Error saving category:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save category",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleAddSubcategory() {
    const name = newSubcategoryName.trim();
    
    if (!name) {
      toast({
        title: "Validation Error",
        description: "Subcategory name is required",
        variant: "destructive",
      });
      return;
    }

    // If category already exists, create subcategory immediately
    if (currentCategoryId) {
      try {
        setIsSubmittingSubcategory(true);
        const res = await fetch(`/api/categories/${currentCategoryId}/subcategories`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name }),
        });

        if (!res.ok) {
          const error = await res.json();
          throw new Error(error.error || "Failed to create subcategory");
        }

        const newSubcategory = await res.json();
        setSubcategories([...subcategories, newSubcategory]);
        setNewSubcategoryName("");
        setIsAddingSubcategory(false);
        // Refresh data for system categories
        if (isSystemCategory) {
          onSuccess?.();
        }
        
        toast({
          title: "Subcategory created",
          description: "Your subcategory has been created successfully.",
          variant: "success",
        });
      } catch (error) {
        console.error("Error creating subcategory:", error);
        toast({
          title: "Error",
          description: error instanceof Error ? error.message : "Failed to create subcategory",
          variant: "destructive",
        });
      } finally {
        setIsSubmittingSubcategory(false);
      }
    } else {
      // If category doesn't exist yet, add to pending list
      const tempId = `temp-${Date.now()}-${Math.random()}`;
      setPendingSubcategories([...pendingSubcategories, { name, tempId }]);
      setNewSubcategoryName("");
      setIsAddingSubcategory(false);
    }
  }

  async function handleUpdateSubcategory(subcategoryId: string) {
    const name = editingSubcategoryName.trim();
    
    if (!name) {
      alert("Subcategory name is required");
      return;
    }

    try {
      setIsSubmittingSubcategory(true);
      const res = await fetch(`/api/categories/subcategories/${subcategoryId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to update subcategory");
      }

      const updatedSubcategory = await res.json();
      setSubcategories(
        subcategories.map((s) => (s.id === subcategoryId ? updatedSubcategory : s))
      );
      setEditingSubcategoryId(null);
      setEditingSubcategoryName("");
      
      toast({
        title: "Subcategory updated",
        description: "Your subcategory has been updated successfully.",
        variant: "success",
      });
    } catch (error) {
      console.error("Error updating subcategory:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update subcategory",
        variant: "destructive",
      });
    } finally {
      setIsSubmittingSubcategory(false);
    }
  }

  function handleUpdatePendingSubcategory(tempId: string) {
    const name = editingSubcategoryName.trim();
    
    if (!name) {
      alert("Subcategory name is required");
      return;
    }

    setPendingSubcategories(
      pendingSubcategories.map((p) => (p.tempId === tempId ? { ...p, name } : p))
    );
    setEditingPendingSubcategoryTempId(null);
    setEditingSubcategoryName("");
  }

  function handleDeletePendingSubcategory(tempId: string) {
    setPendingSubcategories(pendingSubcategories.filter((p) => p.tempId !== tempId));
  }

  async function handleDeleteSubcategory(subcategoryId: string) {
    if (!confirm("Are you sure you want to delete this subcategory?")) {
      return;
    }

    try {
      setIsSubmittingSubcategory(true);
      const res = await fetch(`/api/categories/subcategories/${subcategoryId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to delete subcategory");
      }

      setSubcategories(subcategories.filter((s) => s.id !== subcategoryId));
      
      toast({
        title: "Subcategory deleted",
        description: "Your subcategory has been deleted successfully.",
        variant: "success",
      });
    } catch (error) {
      console.error("Error deleting subcategory:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete subcategory",
        variant: "destructive",
      });
    } finally {
      setIsSubmittingSubcategory(false);
    }
  }

  function startEditingSubcategory(subcategory: Subcategory) {
    setEditingSubcategoryId(subcategory.id);
    setEditingPendingSubcategoryTempId(null);
    setEditingSubcategoryName(subcategory.name);
  }

  function startEditingPendingSubcategory(pending: PendingSubcategory) {
    setEditingPendingSubcategoryTempId(pending.tempId);
    setEditingSubcategoryId(null);
    setEditingSubcategoryName(pending.name);
  }

  function cancelEditingSubcategory() {
    setEditingSubcategoryId(null);
    setEditingPendingSubcategoryTempId(null);
    setEditingSubcategoryName("");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{category ? "Edit" : "Add"} Category</DialogTitle>
          <DialogDescription>
            {category
              ? "Update the category details below."
              : "Create a new category by selecting a group and entering a name."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {!isSystemCategory && (
            <>
              <div className="space-y-1">
                <label className="text-sm font-medium">Group</label>
                <Select
                  value={form.watch("macroId")}
                  onValueChange={(value) => form.setValue("macroId", value)}
                  disabled={!!category}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select group" />
                  </SelectTrigger>
                  <SelectContent>
                    {macros.map((macro) => (
                      <SelectItem key={macro.id} value={macro.id}>
                        {macro.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.formState.errors.macroId && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.macroId.message}
                  </p>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium">Category Name</label>
                <Input
                  {...form.register("name")}
                  placeholder="Enter category name"
                  disabled={!!category}
                />
                {form.formState.errors.name && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.name.message}
                  </p>
                )}
              </div>
            </>
          )}
          
          {isSystemCategory && (
            <div className="space-y-1">
              <label className="text-sm font-medium">Category Name</label>
              <Input
                value={category?.name || ""}
                disabled
                className="bg-muted"
              />
              <p className="text-xs text-muted-foreground">
                System categories cannot be renamed. You can only add subcategories.
              </p>
            </div>
          )}

          <div className="space-y-1">
            <label className="text-sm font-medium">Subcategories</label>
            
            <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto rounded-[12px] border p-2">
              {/* Show pending subcategories (before category is created) */}
              {pendingSubcategories.map((pending) => (
                <div
                  key={pending.tempId}
                  className="group relative inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-muted/50 hover:bg-muted border border-transparent hover:border-border transition-colors"
                >
                  {editingPendingSubcategoryTempId === pending.tempId ? (
                    <div className="flex items-center gap-1.5">
                      <Input
                        value={editingSubcategoryName}
                        onChange={(e) => setEditingSubcategoryName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleUpdatePendingSubcategory(pending.tempId);
                          } else if (e.key === "Escape") {
                            cancelEditingSubcategory();
                          }
                        }}
                        className="h-7 w-24 text-xs"
                        autoFocus
                      />
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6"
                        onClick={() => handleUpdatePendingSubcategory(pending.tempId)}
                        disabled={!editingSubcategoryName.trim()}
                      >
                        <Check className="h-3 w-3" />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6"
                        onClick={cancelEditingSubcategory}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <>
                      <span className="text-xs font-medium text-foreground">{pending.name}</span>
                      <span className="text-xs text-muted-foreground px-1">Pending</span>
                      <div className="flex items-center gap-0.5">
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => startEditingPendingSubcategory(pending)}
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-5 w-5"
                          onClick={() => handleDeletePendingSubcategory(pending.tempId)}
                        >
                          <X className="h-3 w-3 text-black" />
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              ))}
              
              {/* Show created subcategories */}
              {subcategories.map((subcategory) => (
                <div
                  key={subcategory.id}
                  className="group relative inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-muted/50 hover:bg-muted border border-transparent hover:border-border transition-colors"
                >
                  {editingSubcategoryId === subcategory.id ? (
                    <div className="flex items-center gap-1.5">
                      <Input
                        value={editingSubcategoryName}
                        onChange={(e) => setEditingSubcategoryName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleUpdateSubcategory(subcategory.id);
                          } else if (e.key === "Escape") {
                            cancelEditingSubcategory();
                          }
                        }}
                        className="h-7 w-24 text-xs"
                        autoFocus
                      />
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6"
                        onClick={() => handleUpdateSubcategory(subcategory.id)}
                        disabled={isSubmittingSubcategory || !editingSubcategoryName.trim()}
                      >
                        <Check className="h-3 w-3" />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6"
                        onClick={cancelEditingSubcategory}
                        disabled={isSubmittingSubcategory}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <>
                      <span className="text-xs font-medium text-foreground">{subcategory.name}</span>
                      {/* Only show edit/delete buttons for user-created subcategories */}
                      {subcategory.userId !== null && subcategory.userId !== undefined && (
                        <div className="flex items-center gap-0.5">
                          {!isSystemCategory && (
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => startEditingSubcategory(subcategory)}
                              disabled={isSubmittingSubcategory}
                            >
                              <Edit className="h-3 w-3" />
                            </Button>
                          )}
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-5 w-5"
                            onClick={() => handleDeleteSubcategory(subcategory.id)}
                            disabled={isSubmittingSubcategory}
                          >
                            <X className="h-3 w-3 text-black" />
                          </Button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              ))}
              
              {/* Add new subcategory button/input - always at the end */}
              {isAddingSubcategory ? (
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border border-border bg-background">
                  <Input
                    placeholder="Enter name"
                    value={newSubcategoryName}
                    onChange={(e) => setNewSubcategoryName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddSubcategory();
                      } else if (e.key === "Escape") {
                        setIsAddingSubcategory(false);
                        setNewSubcategoryName("");
                      }
                    }}
                    className="h-7 w-24 text-xs border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                    autoFocus
                  />
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6"
                    onClick={handleAddSubcategory}
                    disabled={isSubmittingSubcategory || !newSubcategoryName.trim()}
                  >
                    <Check className="h-3 w-3" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6"
                    onClick={() => {
                      setIsAddingSubcategory(false);
                      setNewSubcategoryName("");
                    }}
                    disabled={isSubmittingSubcategory}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setIsAddingSubcategory(true);
                    setNewSubcategoryName("");
                  }}
                  disabled={isSubmittingSubcategory}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full border border-dashed border-muted-foreground/50 hover:border-muted-foreground text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Plus className="h-3 w-3" />
                  Add
                </button>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                onOpenChange(false);
                // Reload data when closing dialog
                onSuccess?.();
              }}
              disabled={isSubmitting || isSubmittingSubcategory}
            >
              Cancel
            </Button>
            {!currentCategoryId && !isSystemCategory && (
              <Button type="submit" disabled={isSubmitting || !form.watch("name") || !form.watch("macroId")}>
                {isSubmitting ? "Saving..." : "Create"}
              </Button>
            )}
            {currentCategoryId && category && !isSystemCategory && (
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Saving..." : "Update"}
              </Button>
            )}
            {isSystemCategory && category && (
              <Button type="submit" disabled={isSubmitting || isSubmittingSubcategory}>
                {isSubmitting ? "Saving..." : "Save"}
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

