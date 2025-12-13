"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { categorySchema, CategoryFormData } from "@/src/domain/categories/categories.validations";
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
import { Plus, Loader2 } from "lucide-react";
import { useToast } from "@/components/toast-provider";
import type { Category, BaseSubcategory } from "@/src/domain/categories/categories.types";

interface CategoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category?: Category | null;
  onSuccess?: (updatedCategory?: Category) => void;
}

export function CategoryDialog({
  open,
  onOpenChange,
  category,
  onSuccess,
}: CategoryDialogProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [subcategoryNames, setSubcategoryNames] = useState<string[]>([""]);
  const [currentCategoryId, setCurrentCategoryId] = useState<string | null>(category?.id || null);
  
  // Check if this is a system category (userId === null)
  // Only system categories when category exists AND userId is null
  // When category is null (new category), isSystemCategory should be false
  const isSystemCategory = category !== null && category !== undefined && category.userId === null;

  const form = useForm<CategoryFormData>({
    resolver: zodResolver(categorySchema),
    defaultValues: category
      ? {
          name: category.name,
          type: category.type,
        }
      : {
          name: "",
          type: "expense", // Default to expense
        },
  });

  // Reset form and subcategories when dialog opens/closes or category changes
  useEffect(() => {
    if (open) {
      form.reset(
        category
          ? {
              name: category.name,
              type: category.type,
            }
          : {
              name: "",
              type: "expense", // Default to expense
            }
      );
      setCurrentCategoryId(category?.id || null);
      // Reset subcategory inputs - start with one empty input
      setSubcategoryNames([""]);
    }
  }, [open, category, form]);

  async function onSubmit(data: CategoryFormData) {
    try {
      setIsSubmitting(true);
      
      // For system categories, skip the category update and just refresh subcategories
      if (isSystemCategory && category) {
        // Refresh the subcategories list and close dialog
        const res = await fetch(`/api/v2/categories?all=true`);
        if (res.ok) {
          const allCategories = await res.json();
          const updatedCategory = allCategories.find((cat: Category) => cat.id === category.id);
          if (updatedCategory) {
            // Subcategories are now managed through input fields
            // Format the category to match the expected type
            const formattedCategory: Category = {
              id: updatedCategory.id,
              name: updatedCategory.name,
              type: updatedCategory.type,
              userId: updatedCategory.userId,
              subcategories: updatedCategory.subcategories || [],
            };
            onSuccess?.(formattedCategory);
          } else {
            onSuccess?.();
          }
        } else {
          onSuccess?.();
        }
        onOpenChange(false);
        return;
      }
      
      const url = category ? `/api/v2/categories/${category.id}` : "/api/v2/categories";
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
      
      // Create all subcategories from the input fields
      const subcategoryNamesToCreate = subcategoryNames
        .map(name => name.trim())
        .filter(name => name.length > 0);

      if (subcategoryNamesToCreate.length > 0) {
        const subcategoryPromises = subcategoryNamesToCreate.map((name) =>
          fetch(`/api/v2/categories/subcategories`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, categoryId: savedCategory.id, logo: null }),
          })
            .then(async (res) => {
              if (!res.ok) {
                const errorData = await res.json().catch(() => ({ error: "Unknown error" }));
                throw new Error(errorData.error || `Failed to create subcategory: ${name}`);
              }
              return res.json();
            })
            .then((data) => ({ status: "fulfilled" as const, value: data, name }))
            .catch((error) => ({ status: "rejected" as const, reason: error, name }))
        );

        const results = await Promise.all(subcategoryPromises);
        
        // Separate successful and failed subcategories
        const createdSubcategories = results
          .filter((r): r is { status: "fulfilled"; value: BaseSubcategory; name: string } => r.status === "fulfilled")
          .map((r) => r.value);
        
        const failedSubcategories = results
          .filter((r): r is { status: "rejected"; reason: Error; name: string } => r.status === "rejected")
          .map((r) => r.name);

        // Update saved category with created subcategories
        savedCategory.subcategories = createdSubcategories;

        // Show appropriate message based on results
        if (failedSubcategories.length > 0) {
          const successCount = createdSubcategories.length;
          const failedNames = failedSubcategories.join(", ");
          
          if (successCount > 0) {
            toast({
              title: "Partial Success",
              description: `${successCount} subcategor${successCount > 1 ? "ies" : "y"} created successfully. Failed: ${failedNames}. Please add them manually.`,
              variant: "destructive",
            });
          } else {
            toast({
              title: "Subcategories Failed",
              description: `Failed to create subcategories: ${failedNames}. Please add them manually.`,
              variant: "destructive",
            });
          }
        }
      }

      // Format the category to match the expected type
      const formattedCategory: Category = {
        id: savedCategory.id,
        name: savedCategory.name,
        type: savedCategory.type,
        userId: savedCategory.userId,
        subcategories: savedCategory.subcategories || [],
      };

      // Only close dialog and reload if editing existing category
      if (category) {
        onSuccess?.(formattedCategory);
        onOpenChange(false);
        form.reset();
      } else {
        // For new categories, notify parent but keep dialog open
        onSuccess?.(formattedCategory);
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

  function handleSubcategoryNameChange(index: number, value: string) {
    const updated = [...subcategoryNames];
    updated[index] = value;
    setSubcategoryNames(updated);
  }

  function handleAddSubcategoryInput() {
    setSubcategoryNames([...subcategoryNames, ""]);
  }


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl sm:max-h-[90vh] flex flex-col !p-0 !gap-0">
        <DialogHeader>
          <DialogTitle>{category ? "Edit" : "Add"} Category</DialogTitle>
          <DialogDescription>
            {category
              ? "Update the category details below."
              : "Create a new category by entering a name."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
          {/* Show category name and type when creating new category or editing user category */}
          {(!category || !isSystemCategory) && (
            <>
              <div className="space-y-1">
                <label className="text-sm font-medium">Category Name</label>
                <Input
                  {...form.register("name")}
                  placeholder="Enter category name"
                  size="medium"
                  disabled={!!category && isSystemCategory}
                />
                {form.formState.errors.name && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.name.message}
                  </p>
                )}
              </div>
              
              <div className="space-y-1">
                <label className="text-sm font-medium">Type</label>
                <Select
                  value={form.watch("type")}
                  onValueChange={(value) => form.setValue("type", value as "income" | "expense")}
                  disabled={!!category && isSystemCategory}
                >
                  <SelectTrigger size="medium">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="expense">Expense</SelectItem>
                    <SelectItem value="income">Income</SelectItem>
                  </SelectContent>
                </Select>
                {form.formState.errors.type && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.type.message}
                  </p>
                )}
              </div>
            </>
          )}
          
          {/* Show read-only category name for system categories */}
          {category && isSystemCategory && (
            <div className="space-y-1">
              <label className="text-sm font-medium">Category Name</label>
              <Input
                value={category?.name || ""}
                disabled
                size="medium"
                className="bg-muted"
              />
              <p className="text-xs text-muted-foreground">
                System categories cannot be renamed. You can only add subcategories.
              </p>
            </div>
          )}

          <div className="space-y-1">
            <label className="text-sm font-medium">Subcategories</label>
            <div className="space-y-2">
              {subcategoryNames.map((name, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Input
                    placeholder="Subcategory name"
                    value={name}
                    onChange={(e) => handleSubcategoryNameChange(index, e.target.value)}
                    size="medium"
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    onClick={handleAddSubcategoryInput}
                    className="flex-shrink-0"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                onOpenChange(false);
              }}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            {!currentCategoryId && !isSystemCategory && (
              <Button type="submit" disabled={isSubmitting || !form.watch("name")}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Create"
                )}
              </Button>
            )}
            {currentCategoryId && category && !isSystemCategory && (
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Update"
                )}
              </Button>
            )}
            {isSystemCategory && category && (
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save"
                )}
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

