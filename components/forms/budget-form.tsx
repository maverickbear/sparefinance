"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { budgetSchema, BudgetFormData } from "@/lib/validations/budget";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
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
import { useToast } from "@/components/toast-provider";

interface Macro {
  id: string;
  name: string;
}

interface Category {
  id: string;
  name: string;
  macroId: string;
  macro?: {
    id: string;
    name: string;
  };
  subcategories?: Array<{
    id: string;
    name: string;
  }>;
}

interface Budget {
  id: string;
  period: string;
  categoryId?: string | null;
  macroId?: string | null;
  amount: number;
  note?: string | null;
  actualSpend?: number;
  percentage?: number;
  status?: "ok" | "warning" | "over";
  macro?: {
    id: string;
    name: string;
  } | null;
  budgetCategories?: Array<{
    category: {
      id: string;
      name: string;
    };
  }>;
}

interface BudgetFormProps {
  macros?: Macro[];
  categories: Category[];
  period: Date;
  budget?: Budget;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function BudgetForm({
  macros = [],
  categories,
  period,
  budget,
  open,
  onOpenChange,
  onSuccess,
}: BudgetFormProps) {
  const { toast } = useToast();
  const [selectedMacroId, setSelectedMacroId] = useState<string>("");
  const [availableCategories, setAvailableCategories] = useState<Category[]>([]);

  const form = useForm<BudgetFormData>({
    resolver: zodResolver(budgetSchema),
    defaultValues: {
      period,
      macroId: "",
      categoryId: "",
      categoryIds: [],
      amount: 0,
      note: "",
    },
  });

  const categoryIds = form.watch("categoryIds") || [];

  // Load categories when macro is selected (only for new budgets)
  useEffect(() => {
    if (selectedMacroId && !budget) {
      loadCategoriesForMacro(selectedMacroId);
    }
  }, [selectedMacroId, budget]);

  async function loadCategoriesForMacro(macroId: string) {
    try {
      const res = await fetch(`/api/categories?macroId=${macroId}`);
      if (!res.ok) {
        throw new Error("Failed to fetch categories");
      }
      const cats = await res.json();
      setAvailableCategories(cats || []);
    } catch (error) {
      console.error("Error loading categories:", error);
      setAvailableCategories([]);
    }
  }

  // Load budget data when editing
  useEffect(() => {
    if (open && budget) {
      // Determine if it's a grouped budget (has macroId) or single category budget
      if (budget.macroId && budget.macro) {
        // Grouped budget: load macro and related categories
        setSelectedMacroId(budget.macroId);
        loadCategoriesForMacro(budget.macroId);
      } else if (budget.categoryId) {
        // Single category budget: load category and its macro
        const budgetCategory = categories.find((cat) => cat.id === budget.categoryId);
        if (budgetCategory) {
          setSelectedMacroId(budgetCategory.macroId);
          loadCategoriesForMacro(budgetCategory.macroId);
        }
      }
    } else if (open && !budget) {
      // Reset when creating new budget
      setSelectedMacroId("");
      setAvailableCategories([]);
    }
  }, [open, budget, categories]);

  useEffect(() => {
    if (open) {
      if (budget) {
        // Load budget data
        const categoryIds = budget.budgetCategories?.map(bc => bc.category?.id).filter((id): id is string => !!id) || 
                      (budget.categoryId ? [budget.categoryId] : []);
        
        form.reset({
          period: new Date(budget.period),
          categoryId: budget.categoryId || "",
          macroId: budget.macroId || "",
          categoryIds: categoryIds,
          amount: budget.amount,
          note: budget.note || "",
        });
      } else {
        // Reset form for new budget
        form.reset({
          period,
          macroId: "",
          categoryId: "",
          categoryIds: [],
          amount: 0,
          note: "",
        });
      }
    }
  }, [open, budget, period, form]);

  function handleMacroChange(macroId: string) {
    setSelectedMacroId(macroId);
    form.setValue("macroId", macroId);
    form.setValue("categoryIds", []);
    form.setValue("categoryId", "");
  }

  function handleCategoryToggle(categoryId: string) {
    const currentIds = categoryIds || [];
    if (currentIds.includes(categoryId)) {
      form.setValue("categoryIds", currentIds.filter((id) => id !== categoryId));
    } else {
      form.setValue("categoryIds", [...currentIds, categoryId]);
    }
  }

  async function onSubmit(data: BudgetFormData) {
    try {
      // Debug: log the form data
      console.log("Form data:", data);
      console.log("Category IDs:", categoryIds);
      console.log("Selected Macro ID:", selectedMacroId);

      if (budget) {
        // Editing: update single budget
        const res = await fetch(`/api/budgets/${budget.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            amount: data.amount,
            note: data.note || "",
          }),
        });

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({ error: "Unknown error" }));
          throw new Error(errorData.error || "Failed to save budget");
        }

        // Close dialog and reset form first
        onOpenChange(false);
        form.reset();
        setSelectedMacroId("");
        setAvailableCategories([]);

        // Call onSuccess after API response to reload data with updated budget
        if (onSuccess) {
          onSuccess();
        }

        toast({
          title: "Budget updated",
          description: "Your budget has been updated successfully.",
          variant: "success",
        });
        return; // Exit early for update case
      } else {
        // Creating: create a single budget (grouped if multiple categories selected)
        // Use categoryIds from form data first, then fallback to local state, then single categoryId
        const idsToUse = (data.categoryIds && data.categoryIds.length > 0)
          ? data.categoryIds
          : (categoryIds && categoryIds.length > 0)
            ? categoryIds
            : (data.categoryId ? [data.categoryId] : []);

        if (idsToUse.length === 0) {
          throw new Error("At least one category must be selected");
        }

        if (!data.amount || data.amount <= 0) {
          throw new Error("Amount must be greater than zero");
        }

        console.log("Creating budget for categories:", idsToUse);

        // Create a single budget (grouped if multiple categories)
        const requestBody: Record<string, unknown> = {
          period: data.period.toISOString(),
          amount: data.amount,
          note: data.note || "",
        };

        if (idsToUse.length > 1) {
          // Multiple categories: create grouped budget with macroId
          if (!selectedMacroId) {
            throw new Error("Group must be selected when creating a grouped budget");
          }
          requestBody.macroId = selectedMacroId;
          requestBody.categoryIds = idsToUse;
        } else {
          // Single category: create regular budget
          requestBody.categoryId = idsToUse[0];
        }

        const res = await fetch("/api/budgets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
        });

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({ error: "Unknown error" }));
          throw new Error(errorData.error || "Failed to create budget");
        }
      }

      // Close dialog and reset form first
      onOpenChange(false);
      form.reset();
      setSelectedMacroId("");
      setAvailableCategories([]);

      toast({
        title: "Budget created",
        description: "Your budget has been created successfully.",
        variant: "success",
      });

      // Call onSuccess after API response to reload data with the new budget
      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      console.error("Error saving budget:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save budget",
        variant: "destructive",
      });
      // Reload on error to revert optimistic update
      if (onSuccess) {
        onSuccess();
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{budget ? "Edit" : "Add"} Budget</DialogTitle>
          <DialogDescription>
            {budget 
              ? "Update the budget details"
              : "Select a group and choose multiple categories to create budgets"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit, (errors) => {
          console.error("Form validation errors:", errors);
          alert("Please fix the form errors before submitting");
        })} className="space-y-4">
          {budget ? (
            // Editing mode: show group and categories (read-only for grouped, editable for single)
            <>
              {budget.macroId && budget.macro ? (
                // Grouped budget: show macro and related categories
                <>
                  <div className="space-y-1">
                    <label className="text-sm font-medium">Group</label>
                    <Select value={budget.macroId} disabled={true}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {macros.map((macro) => (
                          <SelectItem key={macro.id} value={macro.id}>
                            {macro.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium">Categories</label>
                    <div className="border rounded-[12px] p-4 max-h-60 overflow-y-auto space-y-2">
                      {budget.budgetCategories && budget.budgetCategories.length > 0 ? (
                        budget.budgetCategories.map((bc) => (
                          <div key={bc.category?.id} className="flex items-center space-x-2">
                            <Checkbox
                              id={bc.category?.id}
                              checked={true}
                              disabled={true}
                            />
                            <label
                              htmlFor={bc.category?.id}
                              className="text-sm font-medium flex-1"
                            >
                              {bc.category?.name || "Unknown"}
                            </label>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-muted-foreground">No categories found</p>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                // Single category budget: show category (read-only)
                <div className="space-y-1">
                  <label className="text-sm font-medium">Category</label>
                  <Select
                    value={form.watch("categoryId")}
                    disabled={true}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((category) => {
                        const macro = Array.isArray(category.macro) 
                          ? category.macro[0] 
                          : category.macro;
                        const macroName = macro?.name || "Unknown";
                        return (
                          <SelectItem key={category.id} value={category.id}>
                            {macroName} - {category.name}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </>
          ) : (
            // Creating mode: show group selection and multiple categories
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium">Group *</label>
                <Select
                  value={selectedMacroId}
                  onValueChange={handleMacroChange}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a group" />
                  </SelectTrigger>
                  <SelectContent>
                    {macros.map((macro) => (
                      <SelectItem key={macro.id} value={macro.id}>
                        {macro.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedMacroId && (
                <div className="space-y-1">
                  <label className="text-sm font-medium">Categories *</label>
                  <div className="border rounded-[12px] p-4 max-h-60 overflow-y-auto space-y-2">
                    {availableCategories.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        No categories found for this group
                      </p>
                    ) : (
                      availableCategories.map((category) => (
                        <div key={category.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={category.id}
                            checked={categoryIds.includes(category.id)}
                            onCheckedChange={() => handleCategoryToggle(category.id)}
                          />
                          <label
                            htmlFor={category.id}
                            className="text-sm font-medium cursor-pointer flex-1"
                          >
                            {category.name}
                          </label>
                        </div>
                      ))
                    )}
                  </div>
                  {categoryIds.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {categoryIds.length} categor{categoryIds.length === 1 ? "y" : "ies"} selected
                    </p>
                  )}
                  {form.formState.errors.categoryIds && (
                    <p className="text-xs text-destructive">
                      {form.formState.errors.categoryIds.message}
                    </p>
                  )}
                </div>
              )}
            </>
          )}

          <div className="space-y-1">
            <label className="text-sm font-medium">Amount *</label>
            <Input
              type="text"
              inputMode="decimal"
              placeholder="0.00"
              {...form.register("amount", { valueAsNumber: true })}
            />
            {form.formState.errors.amount && (
              <p className="text-xs text-destructive">
                {form.formState.errors.amount.message}
              </p>
            )}
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Note (optional)</label>
            <Input {...form.register("note")} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">Save</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

