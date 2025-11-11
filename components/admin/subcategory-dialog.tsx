"use client";

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
import { useState } from "react";
import { Loader2 } from "lucide-react";
import type { SystemSubcategory } from "@/lib/api/admin";

const subcategorySchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name must be 100 characters or less"),
  categoryId: z.string().min(1, "Category is required"),
  logo: z.string().url().optional().nullable().or(z.literal("")),
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

  const form = useForm<SubcategoryFormData>({
    resolver: zodResolver(subcategorySchema),
    defaultValues: subcategory
      ? {
          name: subcategory.name,
          categoryId: subcategory.categoryId,
          logo: subcategory.logo || "",
        }
      : {
          name: "",
          categoryId: "",
          logo: "",
        },
  });

  const onSubmit = async (data: SubcategoryFormData) => {
    setIsSubmitting(true);
    try {
      if (subcategory) {
        // Update (only name can be updated)
        const response = await fetch("/api/admin/subcategories", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: subcategory.id,
            name: data.name,
            logo: data.logo?.trim() || null,
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Failed to update subcategory");
        }
      } else {
        // Create
        const response = await fetch("/api/admin/subcategories", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: data.name,
            categoryId: data.categoryId,
            logo: data.logo?.trim() || null,
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Failed to create subcategory");
        }
      }

      onOpenChange(false);
      form.reset();
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {subcategory ? "Edit System Subcategory" : "Create System Subcategory"}
          </DialogTitle>
          <DialogDescription>
            {subcategory
              ? "Update the system subcategory name below."
              : "Create a new system subcategory that will be available to all users."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              {...form.register("name")}
              placeholder="e.g., BC Hydro"
              required
            />
            {form.formState.errors.name && (
              <p className="text-sm text-destructive">
                {form.formState.errors.name.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="logo">Logo URL (optional)</Label>
            <Input
              id="logo"
              {...form.register("logo")}
              placeholder="https://example.com/logo.png"
            />
            {form.formState.errors.logo && (
              <p className="text-sm text-destructive">
                {form.formState.errors.logo.message}
              </p>
            )}
          </div>

          {!subcategory && (
            <div className="space-y-2">
              <Label htmlFor="categoryId">Category</Label>
              <Select
                value={form.watch("categoryId")}
                onValueChange={(value) => form.setValue("categoryId", value)}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  {availableCategories.map((category) => (
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
          )}

          {subcategory && (
            <div className="space-y-2">
              <Label>Category</Label>
              <Input
                value={availableCategories.find((c) => c.id === subcategory.categoryId)?.name || subcategory.categoryId}
                disabled
                className="bg-muted"
              />
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {subcategory ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

