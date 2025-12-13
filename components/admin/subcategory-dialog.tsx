"use client";

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
import React, { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import type { SystemSubcategory } from "@/src/domain/admin/admin.types";

const subcategorySchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name must be 100 characters or less"),
  categoryId: z.string().min(1, "Category is required"),
});

type SubcategoryFormData = z.infer<typeof subcategorySchema>;

interface SubcategoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subcategory?: SystemSubcategory | null;
  availableCategories: { id: string; name: string }[];
  onSuccess?: () => void;
}

export function SubcategoryDialog({
  open,
  onOpenChange,
  subcategory,
  availableCategories,
  onSuccess,
}: SubcategoryDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  // For create mode: textarea text with comma-separated subcategory names
  const [subcategoryNamesText, setSubcategoryNamesText] = useState<string>("");
  // For create mode: selected categoryId (shared for all subcategories)
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("");

  const form = useForm<SubcategoryFormData>({
    resolver: zodResolver(subcategorySchema),
    defaultValues: {
      name: "",
      categoryId: "",
    },
  });

  // Reset form when subcategory prop changes or dialog opens
  useEffect(() => {
    if (open) {
      if (subcategory) {
        // Edit mode: populate form with subcategory data
        form.reset({
          name: subcategory.name,
          categoryId: subcategory.categoryId,
        });
      } else {
        // Create mode: reset form to empty
        form.reset({
          name: "",
          categoryId: "",
        });
        setSubcategoryNamesText("");
        setSelectedCategoryId("");
      }
    }
  }, [open, subcategory, form]);

  // Reset state when dialog opens/closes
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setSubcategoryNamesText("");
      setSelectedCategoryId("");
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
    if (!selectedCategoryId) {
      form.setError("categoryId", { message: "Category is required" });
      return;
    }

    // Parse comma-separated values
    const validNames = parseCommaSeparated(subcategoryNamesText);
    if (validNames.length === 0) {
      alert("Please enter at least one subcategory name");
      return;
    }

    setIsSubmitting(true);
    try {
      // Create all subcategories
      const results = await Promise.allSettled(
        validNames.map((name) =>
          fetch("/api/admin/subcategories", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: name.trim(),
              categoryId: selectedCategoryId,
            }),
          })
        )
      );

      // Check for errors
      const errors: string[] = [];
      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        const subcategoryName = validNames[i];
        
        if (result.status === "rejected") {
          errors.push(`Failed to create "${subcategoryName}": ${result.reason}`);
        } else if (!result.value.ok) {
          try {
            const errorData = await result.value.json();
            errors.push(`Failed to create "${subcategoryName}": ${errorData.error || "Unknown error"}`);
          } catch (parseError) {
            errors.push(`Failed to create "${subcategoryName}": HTTP ${result.value.status}`);
          }
        }
      }

      if (errors.length > 0) {
        const successCount = results.length - errors.length;
        if (successCount > 0) {
          alert(`${successCount} subcategor${successCount > 1 ? "ies" : "y"} created successfully.\n\nErrors:\n${errors.join("\n")}`);
        } else {
          throw new Error(errors.join("\n"));
        }
      }

      handleOpenChange(false);
      form.reset();
      setSubcategoryNamesText("");
      setSelectedCategoryId("");
      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      console.error("Error saving subcategory:", error);
      alert(error instanceof Error ? error.message : "Failed to save subcategory");
    } finally {
      setIsSubmitting(false);
    }
  };

  const onSubmit = async (data: SubcategoryFormData) => {
    setIsSubmitting(true);
    try {
        // Update (only name can be updated)
        const response = await fetch("/api/admin/subcategories", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
          id: subcategory!.id,
            name: data.name.trim(),
            logo: null,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
          const errorMessage = errorData.error || `HTTP ${response.status}: Failed to update subcategory`;
          console.error("Update subcategory error:", errorMessage, errorData);
          throw new Error(errorMessage);
        }

        const updatedSubcategory = await response.json();
        console.log("Subcategory updated successfully:", updatedSubcategory);

      handleOpenChange(false);
      form.reset();
      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      console.error("Error saving subcategory:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to save subcategory";
      alert(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px] sm:max-h-[90vh] flex flex-col !p-0 !gap-0">
        <DialogHeader>
          <DialogTitle>
            {subcategory ? "Edit System Subcategory" : "Create System Subcategories"}
          </DialogTitle>
          <DialogDescription>
            {subcategory
              ? "Update the system subcategory name below."
              : "Create one or more system subcategories separated by commas. They will be available to all users."}
          </DialogDescription>
        </DialogHeader>

        <form 
          onSubmit={subcategory ? form.handleSubmit(onSubmit) : handleCreateSubmit} 
          className="flex flex-col flex-1 overflow-hidden"
        >
          <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
          {subcategory ? (
            // Edit mode: single subcategory form
            <>
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              {...form.register("name")}
              placeholder="e.g., BC Hydro"
              size="medium"
              required
            />
            {form.formState.errors.name && (
              <p className="text-sm text-destructive">
                {form.formState.errors.name.message}
              </p>
            )}
          </div>

              <div className="space-y-2">
                <Label>Category</Label>
                <Input
                  value={availableCategories.find((c) => c.id === subcategory.categoryId)?.name || subcategory.categoryId}
                  disabled
                  size="medium"
                  className="bg-muted"
                />
              </div>
            </>
          ) : (
            // Create mode: textarea with comma-separated values
            <>
            <div className="space-y-2">
              <Label htmlFor="categoryId">Category</Label>
              <Select
                  value={selectedCategoryId}
                  onValueChange={(value) => {
                    setSelectedCategoryId(value);
                    form.setValue("categoryId", value);
                  }}
                required
              >
                <SelectTrigger size="medium">
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  {availableCategories
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              {form.formState.errors.categoryId && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.categoryId.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
                <Label htmlFor="subcategoryNames">Subcategory Names (comma-separated)</Label>
                <Textarea
                  id="subcategoryNames"
                  value={subcategoryNamesText}
                  onChange={(e) => setSubcategoryNamesText(e.target.value)}
                  placeholder="e.g., BC Hydro, Fortis BC, Internet"
                  size="medium"
                  rows={4}
                  className="resize-none"
                />
                <p className="text-xs text-muted-foreground">
                  Enter multiple subcategory names separated by commas. Each will be created as a separate subcategory.
                </p>
            </div>
            </>
          )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="medium"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              size="medium"
              disabled={
                isSubmitting || 
                (!subcategory && (!selectedCategoryId || parseCommaSeparated(subcategoryNamesText).length === 0))
              }
            >
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {subcategory ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

