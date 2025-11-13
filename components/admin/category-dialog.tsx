"use client";

import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Loader2, Plus, X } from "lucide-react";
import type { SystemCategory } from "@/lib/api/admin";

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
  // For create mode: array of category names
  const [categoryNames, setCategoryNames] = useState<string[]>([""]);
  // For create mode: selected macroId (shared for all categories)
  const [selectedMacroId, setSelectedMacroId] = useState<string>("");

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

  // Reset state when dialog opens/closes
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      // Reset when closing
      setCategoryNames([""]);
      setSelectedMacroId("");
      form.reset();
    }
    onOpenChange(newOpen);
  };

  const addCategoryInput = () => {
    setCategoryNames([...categoryNames, ""]);
  };

  const removeCategoryInput = (index: number) => {
    if (categoryNames.length > 1) {
      setCategoryNames(categoryNames.filter((_, i) => i !== index));
    }
  };

  const updateCategoryName = (index: number, value: string) => {
    const updated = [...categoryNames];
    updated[index] = value;
    setCategoryNames(updated);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate manually for create mode
    if (!selectedMacroId) {
      form.setError("macroId", { message: "Group is required" });
      return;
    }

    // Filter out empty names
    const validNames = categoryNames.filter((name) => name.trim() !== "");
    if (validNames.length === 0) {
      alert("At least one category name is required");
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
      setCategoryNames([""]);
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
          id: category.id,
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
          onSubmit={category ? form.handleSubmit(onSubmit) : handleCreateSubmit} 
          className="flex flex-col flex-1 overflow-hidden"
        >
          <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
            {category ? (
              // Edit mode: single category form
              <>
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    {...form.register("name")}
                    placeholder="e.g., Rent"
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
                    <SelectTrigger>
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
              // Create mode: multiple categories
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
                    <SelectTrigger>
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

                <div className="space-y-3">
                  <Label>Category Names</Label>
                  {categoryNames.map((name, index) => (
                    <div key={index} className="flex gap-2 items-start">
                      <div className="flex-1 space-y-1">
                        <Input
                          value={name}
                          onChange={(e) => updateCategoryName(index, e.target.value)}
                          placeholder={`Category ${index + 1} (e.g., Rent)`}
                        />
                      </div>
                      {categoryNames.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-10 w-10 shrink-0"
                          onClick={() => removeCategoryInput(index)}
                          disabled={isSubmitting}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    onClick={addCategoryInput}
                    disabled={isSubmitting}
                    className="w-full"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add More
                  </Button>
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={
                isSubmitting || 
                (!category && (!selectedMacroId || categoryNames.every(name => name.trim() === "")))
              }
            >
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {category ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

