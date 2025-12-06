"use client";

import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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
import { Loader2 } from "lucide-react";
import type { SystemCategory } from "@/src/domain/admin/admin.types";

const categorySchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name must be 100 characters or less"),
  macroId: z.string().min(1, "Group is required"),
});

type CategoryFormData = z.infer<typeof categorySchema>;

interface CategoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category?: SystemCategory | null;
  availableMacros: { id: string; name: string }[];
  onSuccess?: () => void;
}

export function CategoryDialog({
  open,
  onOpenChange,
  category,
  availableMacros,
  onSuccess,
}: CategoryDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fetchedCategory, setFetchedCategory] = useState<SystemCategory | null>(null);
  // For create mode: textarea text with comma-separated category names
  const [categoryNamesText, setCategoryNamesText] = useState<string>("");
  // For create mode: selected macroId (shared for all categories)
  const [selectedMacroId, setSelectedMacroId] = useState<string>("");

  // Use fetched category if available, otherwise use prop category
  const currentCategory = fetchedCategory || category;

  const form = useForm<CategoryFormData>({
    resolver: zodResolver(categorySchema),
    defaultValues: currentCategory
      ? {
          name: currentCategory.name,
          macroId: currentCategory.macroId,
        }
      : {
          name: "",
          macroId: "",
        },
  });

  // Update form when category changes
  useEffect(() => {
    if (currentCategory) {
      form.reset({
        name: currentCategory.name,
        macroId: currentCategory.macroId,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentCategory?.id]);

  // Fetch category from Supabase only once when category ID changes (not every time modal opens)
  // Use prop data immediately, fetch in background only if needed
  useEffect(() => {
    if (category?.id) {
      // Only fetch if we don't have fetched data for this ID yet
      const lastFetchedId = fetchedCategory?.id;
      if (lastFetchedId !== category.id) {
        // Fetch in background without showing loading (use prop data immediately)
        fetch(`/api/admin/categories`)
          .then((res) => {
            if (!res.ok) {
              throw new Error("Failed to fetch categories");
            }
            return res.json();
          })
          .then((categories: SystemCategory[]) => {
            const foundCategory = categories.find((c) => c.id === category.id);
            if (foundCategory) {
              setFetchedCategory(foundCategory);
            }
          })
          .catch((error) => {
            console.error("Error fetching category:", error);
          });
      }
    } else {
      // Reset fetched category when category is cleared
      setFetchedCategory(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category?.id]);

  // Reset state when dialog opens/closes
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      // Reset when closing
      setCategoryNamesText("");
      setSelectedMacroId("");
      form.reset();
    }
    onOpenChange(newOpen);
  };

  // Helper function to parse comma-separated values
  const parseCommaSeparated = (text: string): string[] => {
    return text
      .split(",")
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate manually for create mode
    if (!selectedMacroId) {
      form.setError("macroId", { message: "Group is required" });
      return;
    }

    // Parse comma-separated values
    const validNames = parseCommaSeparated(categoryNamesText);
    if (validNames.length === 0) {
      alert("Please enter at least one category name");
      return;
    }

    setIsSubmitting(true);
    try {
      // Create all categories
      const results = await Promise.allSettled(
        validNames.map((name) =>
          fetch("/api/admin/categories", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: name.trim(),
              macroId: selectedMacroId,
            }),
          })
        )
      );

      // Check for errors
      const errors: string[] = [];
      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        const categoryName = validNames[i];
        
        if (result.status === "rejected") {
          errors.push(`Failed to create "${categoryName}": ${result.reason}`);
        } else if (!result.value.ok) {
          try {
            const errorData = await result.value.json();
            errors.push(`Failed to create "${categoryName}": ${errorData.error || "Unknown error"}`);
          } catch (parseError) {
            errors.push(`Failed to create "${categoryName}": HTTP ${result.value.status}`);
          }
        }
      }

      if (errors.length > 0) {
        // Some failed, but some might have succeeded
        const successCount = results.length - errors.length;
        if (successCount > 0) {
          alert(`${successCount} categor${successCount > 1 ? "ies" : "y"} created successfully.\n\nErrors:\n${errors.join("\n")}`);
        } else {
          throw new Error(errors.join("\n"));
        }
      }

      handleOpenChange(false);
      form.reset();
      setCategoryNamesText("");
      setSelectedMacroId("");
      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      console.error("Error saving category:", error);
      alert(error instanceof Error ? error.message : "Failed to save category");
    } finally {
      setIsSubmitting(false);
    }
  };

  const onSubmit = async (data: CategoryFormData) => {
    setIsSubmitting(true);
    try {
      // Update mode: single category
      const response = await fetch("/api/admin/categories", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: currentCategory?.id,
          name: data.name,
          macroId: data.macroId,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update category");
      }

      handleOpenChange(false);
      form.reset();
      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      console.error("Error saving category:", error);
      alert(error instanceof Error ? error.message : "Failed to save category");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px] sm:max-h-[90vh] flex flex-col !p-0 !gap-0">
        <DialogHeader>
          <DialogTitle>
            {category ? "Edit System Category" : "Create System Categories"}
          </DialogTitle>
          <DialogDescription>
            {category
              ? "Update the system category details below."
              : "Create one or more system categories that will be available to all users."}
          </DialogDescription>
        </DialogHeader>

        <form 
          onSubmit={currentCategory ? form.handleSubmit(onSubmit) : handleCreateSubmit} 
          className="flex flex-col flex-1 overflow-hidden"
        >
          <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
            {currentCategory ? (
              // Edit mode: single category form
              <>
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    {...form.register("name")}
                    placeholder="e.g., Rent"
                    size="small"
                    required
                  />
                  {form.formState.errors.name && (
                    <p className="text-sm text-destructive">
                      {form.formState.errors.name.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="macroId">Group</Label>
                  <Select
                    value={form.watch("macroId")}
                    onValueChange={(value) => form.setValue("macroId", value)}
                    required
                  >
                    <SelectTrigger size="small">
                      <SelectValue placeholder="Select a group" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableMacros.map((macro) => (
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
              </>
            ) : (
              // Create mode: textarea with comma-separated values
              <>
                <div className="space-y-2">
                  <Label htmlFor="macroId">Group</Label>
                  <Select
                    value={selectedMacroId}
                    onValueChange={(value) => {
                      setSelectedMacroId(value);
                      form.setValue("macroId", value);
                    }}
                    required
                  >
                    <SelectTrigger size="small">
                      <SelectValue placeholder="Select a group" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableMacros.map((macro) => (
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

                <div className="space-y-2">
                  <Label htmlFor="categoryNames">Category Names (comma-separated)</Label>
                  <Textarea
                    id="categoryNames"
                    value={categoryNamesText}
                    onChange={(e) => setCategoryNamesText(e.target.value)}
                    placeholder="e.g., Rent, Utilities, Home Maintenance"
                    size="small"
                    rows={4}
                    className="resize-none"
                  />
                  <p className="text-xs text-muted-foreground">
                    Enter multiple category names separated by commas. Each will be created as a separate category.
                  </p>
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="small"
              onClick={() => handleOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              size="small"
              disabled={
                isSubmitting || 
                (!currentCategory && (!selectedMacroId || parseCommaSeparated(categoryNamesText).length === 0))
              }
            >
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {currentCategory ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

