"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useState } from "react";
import { Plus, Edit, Trash2, X, Check, Loader2 } from "lucide-react";
import { useToast } from "@/components/toast-provider";

const groupSchema = z.object({
  name: z.string().min(1, "Group name is required"),
});

type GroupFormData = z.infer<typeof groupSchema>;

interface PendingCategory {
  name: string;
  tempId: string;
  subcategories: PendingSubcategory[];
}

interface PendingSubcategory {
  name: string;
  tempId: string;
}

interface GroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function GroupDialog({
  open,
  onOpenChange,
  onSuccess,
}: GroupDialogProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingCategories, setPendingCategories] = useState<PendingCategory[]>([]);
  const [editingCategoryTempId, setEditingCategoryTempId] = useState<string | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState("");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [editingSubcategoryTempId, setEditingSubcategoryTempId] = useState<string | null>(null);
  const [editingSubcategoryName, setEditingSubcategoryName] = useState("");
  const [newSubcategoryName, setNewSubcategoryName] = useState("");
  const [isAddingSubcategory, setIsAddingSubcategory] = useState(false);
  const [selectedCategoryTempId, setSelectedCategoryTempId] = useState<string | null>(null);
  const [createdMacroId, setCreatedMacroId] = useState<string | null>(null);

  const form = useForm<GroupFormData>({
    resolver: zodResolver(groupSchema),
    defaultValues: {
      name: "",
    },
  });

  function resetForm() {
    form.reset({ name: "" });
    setPendingCategories([]);
    setEditingCategoryTempId(null);
    setEditingCategoryName("");
    setNewCategoryName("");
    setIsAddingCategory(false);
    setEditingSubcategoryTempId(null);
    setEditingSubcategoryName("");
    setNewSubcategoryName("");
    setIsAddingSubcategory(false);
    setSelectedCategoryTempId(null);
    setCreatedMacroId(null);
  }

  async function onSubmit(data: GroupFormData) {
    try {
      setIsSubmitting(true);

      // First, create the macro (group)
      const macroRes = await fetch("/api/v2/categories/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: data.name }),
      });

      if (!macroRes.ok) {
        const error = await macroRes.json();
        throw new Error(error.error || "Failed to create group");
      }

      const macro = await macroRes.json();
      setCreatedMacroId(macro.id);

      // If there are pending categories, create them
      if (pendingCategories.length > 0) {
        for (const pendingCategory of pendingCategories) {
          // Create category
          const categoryRes = await fetch("/api/v2/categories", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: pendingCategory.name,
              groupId: macro.id,
            }),
          });

          if (!categoryRes.ok) {
            const error = await categoryRes.json();
            throw new Error(error.error || `Failed to create category: ${pendingCategory.name}`);
          }

          const category = await categoryRes.json();

          // Create subcategories for this category
          if (pendingCategory.subcategories.length > 0) {
            for (const pendingSubcategory of pendingCategory.subcategories) {
              const subcategoryRes = await fetch("/api/v2/categories/subcategories", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ 
                  name: pendingSubcategory.name,
                  categoryId: category.id 
                }),
              });

              if (!subcategoryRes.ok) {
                const error = await subcategoryRes.json();
                console.error(`Failed to create subcategory: ${pendingSubcategory.name}`, error);
                // Continue with other subcategories even if one fails
              }
            }
          }
        }
      }

      // Wait a bit to ensure cache invalidation has propagated
      await new Promise(resolve => setTimeout(resolve, 300));
      
      onSuccess?.();
      onOpenChange(false);
      resetForm();
      
      toast({
        title: "Group created",
        description: "Your group has been created successfully.",
        variant: "success",
      });
    } catch (error) {
      console.error("Error creating group:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create group",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleAddCategory() {
    const name = newCategoryName.trim();
    
    if (!name) {
      toast({
        title: "Validation Error",
        description: "Category name is required",
        variant: "destructive",
      });
      return;
    }

    const tempId = `temp-cat-${Date.now()}-${Math.random()}`;
    setPendingCategories([
      ...pendingCategories,
      { name, tempId, subcategories: [] },
    ]);
    setNewCategoryName("");
    setIsAddingCategory(false);
  }

  function handleUpdateCategory(tempId: string) {
    const name = editingCategoryName.trim();
    
    if (!name) {
      toast({
        title: "Validation Error",
        description: "Category name is required",
        variant: "destructive",
      });
      return;
    }

    setPendingCategories(
      pendingCategories.map((cat) => (cat.tempId === tempId ? { ...cat, name } : cat))
    );
    setEditingCategoryTempId(null);
    setEditingCategoryName("");
  }

  function handleDeleteCategory(tempId: string) {
    setPendingCategories(pendingCategories.filter((cat) => cat.tempId !== tempId));
    if (selectedCategoryTempId === tempId) {
      setSelectedCategoryTempId(null);
    }
  }

  function handleAddSubcategory(categoryTempId: string) {
    const name = newSubcategoryName.trim();
    
    if (!name) {
      toast({
        title: "Validation Error",
        description: "Subcategory name is required",
        variant: "destructive",
      });
      return;
    }

    const tempId = `temp-sub-${Date.now()}-${Math.random()}`;
    setPendingCategories(
      pendingCategories.map((cat) =>
        cat.tempId === categoryTempId
          ? { ...cat, subcategories: [...cat.subcategories, { name, tempId }] }
          : cat
      )
    );
    setNewSubcategoryName("");
    setIsAddingSubcategory(false);
    setSelectedCategoryTempId(null);
  }

  function handleUpdateSubcategory(categoryTempId: string, subcategoryTempId: string) {
    const name = editingSubcategoryName.trim();
    
    if (!name) {
      toast({
        title: "Validation Error",
        description: "Subcategory name is required",
        variant: "destructive",
      });
      return;
    }

    setPendingCategories(
      pendingCategories.map((cat) =>
        cat.tempId === categoryTempId
          ? {
              ...cat,
              subcategories: cat.subcategories.map((sub) =>
                sub.tempId === subcategoryTempId ? { ...sub, name } : sub
              ),
            }
          : cat
      )
    );
    setEditingSubcategoryTempId(null);
    setEditingSubcategoryName("");
  }

  function handleDeleteSubcategory(categoryTempId: string, subcategoryTempId: string) {
    setPendingCategories(
      pendingCategories.map((cat) =>
        cat.tempId === categoryTempId
          ? {
              ...cat,
              subcategories: cat.subcategories.filter((sub) => sub.tempId !== subcategoryTempId),
            }
          : cat
      )
    );
  }

  function startEditingCategory(category: PendingCategory) {
    setEditingCategoryTempId(category.tempId);
    setEditingCategoryName(category.name);
    setSelectedCategoryTempId(null);
  }

  function startEditingSubcategory(subcategory: PendingSubcategory) {
    setEditingSubcategoryTempId(subcategory.tempId);
    setEditingSubcategoryName(subcategory.name);
  }

  function cancelEditing() {
    setEditingCategoryTempId(null);
    setEditingCategoryName("");
    setEditingSubcategoryTempId(null);
    setEditingSubcategoryName("");
    setSelectedCategoryTempId(null);
    setIsAddingCategory(false);
    setIsAddingSubcategory(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(open) => {
        if (!open) {
          resetForm();
        }
        onOpenChange(open);
      }}
    >
      <DialogContent className="sm:max-w-2xl sm:max-h-[90vh] flex flex-col !p-0 !gap-0">
        <DialogHeader>
          <DialogTitle>Create Group</DialogTitle>
          <DialogDescription>
            Create a new group with categories and subcategories.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-medium">Group Name</label>
            <Input
              {...form.register("name")}
              placeholder="Enter group name"
              disabled={isSubmitting || !!createdMacroId}
            />
            {form.formState.errors.name && (
              <p className="text-sm text-destructive">
                {form.formState.errors.name.message}
              </p>
            )}
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Categories</label>
              {!createdMacroId && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsAddingCategory(true);
                    setSelectedCategoryTempId(null);
                  }}
                  disabled={isAddingCategory || isSubmitting}
                >
                  <Plus className="mr-1 h-3 w-3" />
                  Add Category
                </Button>
              )}
            </div>

            {isAddingCategory && (
              <div className="flex items-center gap-2">
                <Input
                  placeholder="Enter category name"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddCategory();
                    } else if (e.key === "Escape") {
                      cancelEditing();
                    }
                  }}
                  autoFocus
                />
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={handleAddCategory}
                  disabled={!newCategoryName.trim()}
                >
                  <Check className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={cancelEditing}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}

            <div className="space-y-2 max-h-64 overflow-y-auto rounded-lg border p-4">
              {pendingCategories.length === 0 && !isAddingCategory ? (
                <p className="text-sm text-muted-foreground text-center py-2">
                  No categories yet
                </p>
              ) : (
                pendingCategories.map((category) => (
                  <div
                    key={category.tempId}
                    className="space-y-2 p-2 border rounded-lg"
                  >
                    {editingCategoryTempId === category.tempId ? (
                      <div className="flex items-center gap-2">
                        <Input
                          value={editingCategoryName}
                          onChange={(e) => setEditingCategoryName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              handleUpdateCategory(category.tempId);
                            } else if (e.key === "Escape") {
                              cancelEditing();
                            }
                          }}
                          className="flex-1"
                          autoFocus
                        />
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          onClick={() => handleUpdateCategory(category.tempId)}
                          disabled={!editingCategoryName.trim()}
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          onClick={cancelEditing}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="flex-1 text-sm font-medium">{category.name}</span>
                        {!createdMacroId && (
                          <>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              onClick={() => {
                                setSelectedCategoryTempId(
                                  selectedCategoryTempId === category.tempId ? null : category.tempId
                                );
                                setIsAddingSubcategory(false);
                              }}
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              onClick={() => startEditingCategory(category)}
                            >
                              <Edit className="h-3 w-3" />
                            </Button>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              onClick={() => handleDeleteCategory(category.tempId)}
                            >
                              <Trash2 className="h-3 w-3 text-destructive" />
                            </Button>
                          </>
                        )}
                      </div>
                    )}

                    {/* Subcategories */}
                    {selectedCategoryTempId === category.tempId && !createdMacroId && (
                      <div className="mt-3 pl-4 border-l-2 border-muted space-y-2">
                        <div className="space-y-2">
                          {category.subcategories.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                              {category.subcategories.map((subcategory) => (
                                <div
                                  key={subcategory.tempId}
                                  className="group relative inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-muted/50 hover:bg-muted border border-transparent hover:border-border transition-colors"
                                >
                                  {editingSubcategoryTempId === subcategory.tempId ? (
                                    <div className="flex items-center gap-1.5">
                                      <Input
                                        value={editingSubcategoryName}
                                        onChange={(e) => setEditingSubcategoryName(e.target.value)}
                                        onKeyDown={(e) => {
                                          if (e.key === "Enter") {
                                            e.preventDefault();
                                            handleUpdateSubcategory(category.tempId, subcategory.tempId);
                                          } else if (e.key === "Escape") {
                                            cancelEditing();
                                          }
                                        }}
                                        className="h-7 w-24 text-xs"
                                        autoFocus
                                      />
                                      <Button
                                        type="button"
                                        size="icon"
                                        variant="ghost"
                                        className="h-7 w-7"
                                        onClick={() =>
                                          handleUpdateSubcategory(category.tempId, subcategory.tempId)
                                        }
                                        disabled={!editingSubcategoryName.trim()}
                                      >
                                        <Check className="h-4 w-4" />
                                      </Button>
                                      <Button
                                        type="button"
                                        size="icon"
                                        variant="ghost"
                                        className="h-7 w-7"
                                        onClick={cancelEditing}
                                      >
                                        <X className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  ) : (
                                    <>
                                      <span className="text-xs font-medium text-foreground">
                                        {subcategory.name}
                                      </span>
                                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Button
                                          type="button"
                                          size="icon"
                                          variant="ghost"
                                          className="h-6 w-6"
                                          onClick={() => startEditingSubcategory(subcategory)}
                                        >
                                          <Edit className="h-4 w-4" />
                                        </Button>
                                        <Button
                                          type="button"
                                          size="icon"
                                          variant="ghost"
                                          className="h-6 w-6"
                                          onClick={() =>
                                            handleDeleteSubcategory(category.tempId, subcategory.tempId)
                                          }
                                        >
                                          <Trash2 className="h-4 w-4 text-destructive" />
                                        </Button>
                                      </div>
                                    </>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}

                          {isAddingSubcategory && (
                            <div className="flex items-center gap-2">
                              <Input
                                placeholder="Enter subcategory name"
                                value={newSubcategoryName}
                                onChange={(e) => setNewSubcategoryName(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    e.preventDefault();
                                    handleAddSubcategory(category.tempId);
                                  } else if (e.key === "Escape") {
                                    setIsAddingSubcategory(false);
                                    setNewSubcategoryName("");
                                  }
                                }}
                                className="h-8 text-sm"
                                autoFocus
                              />
                              <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8"
                                onClick={() => handleAddSubcategory(category.tempId)}
                                disabled={!newSubcategoryName.trim()}
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                              <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8"
                                onClick={() => {
                                  setIsAddingSubcategory(false);
                                  setNewSubcategoryName("");
                                }}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          )}

                          {!isAddingSubcategory && (
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => {
                                setIsAddingSubcategory(true);
                                setNewSubcategoryName("");
                              }}
                              className="h-8 text-xs"
                            >
                              <Plus className="mr-1.5 h-3 w-3" />
                              Add Subcategory
                            </Button>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Show subcategories count if not expanded */}
                    {selectedCategoryTempId !== category.tempId &&
                      category.subcategories.length > 0 && (
                        <div className="mt-2 pl-4">
                          <div className="flex flex-wrap gap-1.5">
                            {category.subcategories.slice(0, 3).map((subcategory) => (
                              <span
                                key={subcategory.tempId}
                                className="inline-flex items-center px-2 py-0.5 rounded-md text-xs bg-muted/50 text-muted-foreground"
                              >
                                {subcategory.name}
                              </span>
                            ))}
                            {category.subcategories.length > 3 && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs bg-muted/50 text-muted-foreground">
                                +{category.subcategories.length - 3} more
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                  </div>
                ))
              )}
            </div>
          </div>

          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                onOpenChange(false);
                resetForm();
              }}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            {!createdMacroId && (
              <Button
                type="submit"
                disabled={isSubmitting || !form.watch("name")}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create Group"
                )}
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

