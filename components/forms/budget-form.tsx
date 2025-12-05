"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { budgetSchema, BudgetFormData } from "@/src/domain/budgets/budgets.validations";
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
import { useToast } from "@/components/toast-provider";
import { Loader2 } from "lucide-react";
import { DollarAmountInput } from "@/components/common/dollar-amount-input";
import { Checkbox } from "@/components/ui/checkbox";
import { AccountRequiredDialog } from "@/components/common/account-required-dialog";

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
  subcategoryId?: string | null;
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedMacroId, setSelectedMacroId] = useState<string>("");
  const [availableCategories, setAvailableCategories] = useState<Category[]>([]);
  const [subcategoriesMap, setSubcategoriesMap] = useState<Map<string, Array<{ id: string; name: string }>>>(new Map());
  const [showAccountDialog, setShowAccountDialog] = useState(false);
  const [shouldShowForm, setShouldShowForm] = useState(false);

  const form = useForm<BudgetFormData>({
    resolver: zodResolver(budgetSchema),
    defaultValues: {
      period,
      macroId: "",
      categoryId: "",
      subcategoryId: "",
      amount: 0,
    },
  });

  const selectedCategoryId = form.watch("categoryId") || "";
  const selectedSubcategoryId = form.watch("subcategoryId") || "";

  // Load categories when macro is selected (only for new budgets)
  useEffect(() => {
    if (selectedMacroId && !budget) {
      loadCategoriesForMacro(selectedMacroId);
    }
  }, [selectedMacroId, budget]);

  async function loadCategoriesForMacro(macroId: string) {
    try {
      const res = await fetch(`/api/v2/categories?macroId=${macroId}`);
      if (!res.ok) {
        throw new Error("Failed to fetch categories");
      }
      const cats = await res.json();
      setAvailableCategories(cats || []);
      
      // Load subcategories for all categories
      const newSubcategoriesMap = new Map<string, Array<{ id: string; name: string }>>();
      for (const category of cats || []) {
        if (category.subcategories && category.subcategories.length > 0) {
          newSubcategoriesMap.set(category.id, category.subcategories);
        } else {
          // Fetch subcategories if not included
          try {
            const subRes = await fetch(`/api/v2/categories?categoryId=${category.id}`);
            if (subRes.ok) {
              const subcats = await subRes.json();
              if (subcats && subcats.length > 0) {
                newSubcategoriesMap.set(category.id, subcats);
              }
            }
          } catch (err) {
            console.error("Error loading subcategories:", err);
          }
        }
      }
      setSubcategoriesMap(newSubcategoriesMap);
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
          // If budget has subcategoryId, ensure subcategories are loaded
          if (budget.subcategoryId) {
            // Subcategories will be loaded by loadCategoriesForMacro
          }
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
      // If editing a budget, no need to check accounts
      if (budget) {
        setShouldShowForm(true);
        // Load budget data
        form.reset({
          period: new Date(budget.period),
          categoryId: budget.categoryId || "",
          subcategoryId: budget.subcategoryId || "",
          macroId: budget.macroId || "",
          amount: budget.amount,
        });
      } else {
        // If creating a new budget, check if there are accounts
        checkAccountsAndShowForm();
      }
    } else {
      setShouldShowForm(false);
      setShowAccountDialog(false);
    }
  }, [open, budget, period, form]);

  async function checkAccountsAndShowForm() {
    try {
      // OPTIMIZED: Skip investment balances calculation (not needed for budget form)
      const accountsRes = await fetch("/api/v2/accounts?includeHoldings=false");
      if (accountsRes.ok) {
        const accountsData = await accountsRes.json().catch(() => []);
        if (accountsData.length === 0) {
          // No accounts, show the dialog
          setShowAccountDialog(true);
          setShouldShowForm(false);
        } else {
          // Has accounts, can show the form
          setShouldShowForm(true);
          // Reset form for new budget
          form.reset({
            period,
            macroId: "",
            categoryId: "",
            subcategoryId: "",
            amount: 0,
          });
        }
      } else {
        // Error fetching accounts, try to show the form anyway
        setShouldShowForm(true);
      }
    } catch (error) {
      console.error("Error checking accounts:", error);
      // In case of error, try to show the form anyway
      setShouldShowForm(true);
    }
  }

  function handleMacroChange(macroId: string) {
    setSelectedMacroId(macroId);
    form.setValue("macroId", macroId);
    form.setValue("categoryId", "");
    form.setValue("subcategoryId", "");
  }

  function handleCategoryChange(categoryId: string) {
    form.setValue("categoryId", categoryId);
    form.setValue("subcategoryId", ""); // Clear subcategory when category changes
  }

  function handleSubcategoryChange(subcategoryId: string) {
    form.setValue("subcategoryId", subcategoryId);
  }

  async function onSubmit(data: BudgetFormData) {
    try {
      setIsSubmitting(true);

      if (budget) {
        // Editing: update single budget
        const res = await fetch(`/api/v2/budgets/${budget.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            amount: data.amount,
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
        // Creating: create a single budget
        if (!data.categoryId) {
          throw new Error("Category must be selected");
        }

        if (!data.amount || data.amount <= 0) {
          throw new Error("Amount must be greater than zero");
        }

        // Create a single budget
        const requestBody: Record<string, unknown> = {
          period: data.period.toISOString(),
          amount: data.amount,
          categoryId: data.categoryId,
        };

        // Add macroId if selected
        if (selectedMacroId) {
          requestBody.macroId = selectedMacroId;
        }

        // Add subcategoryId if selected
        if (data.subcategoryId) {
          requestBody.subcategoryId = data.subcategoryId;
        }

        const res = await fetch("/api/v2/budgets", {
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
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <AccountRequiredDialog
        open={showAccountDialog}
        onOpenChange={(isOpen) => {
          setShowAccountDialog(isOpen);
          if (!isOpen) {
            onOpenChange(false);
          }
        }}
        onAccountCreated={() => {
          setShowAccountDialog(false);
          checkAccountsAndShowForm();
        }}
      />
      {shouldShowForm && (
        <Dialog open={open} onOpenChange={onOpenChange}>
          <DialogContent className="sm:max-h-[90vh] flex flex-col !p-0 !gap-0">
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
        })} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
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
                    <div className="border rounded-lg p-4 max-h-60 overflow-y-auto space-y-2">
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
                // Single category budget: show category and subcategory (read-only)
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                  {form.watch("subcategoryId") && (
                    <div className="space-y-1">
                      <label className="text-sm font-medium">Subcategory</label>
                      <Select
                        value={form.watch("subcategoryId")}
                        disabled={true}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {(() => {
                            const selectedCategoryId = form.watch("categoryId");
                            if (!selectedCategoryId) return null;
                            const subcategories = subcategoriesMap.get(selectedCategoryId) || [];
                            return subcategories.map((subcategory) => (
                              <SelectItem key={subcategory.id} value={subcategory.id}>
                                {subcategory.name}
                              </SelectItem>
                            ));
                          })()}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            // Creating mode: show group selection and category/subcategory
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Group {!selectedMacroId && <span className="text-gray-400 text-[12px]">required</span>}
                </label>
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      Category {!selectedCategoryId && <span className="text-gray-400 text-[12px]">required</span>}
                    </label>
                    <Select
                      value={selectedCategoryId}
                      onValueChange={handleCategoryChange}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a category" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableCategories.length === 0 ? (
                          <div className="p-2 text-sm text-muted-foreground">
                            No categories found for this group
                          </div>
                        ) : (
                          availableCategories.map((category) => (
                            <SelectItem key={category.id} value={category.id}>
                              {category.name}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    {form.formState.errors.categoryId && (
                      <p className="text-xs text-destructive">
                        {form.formState.errors.categoryId.message}
                      </p>
                    )}
                  </div>

                  {selectedCategoryId && (
                    <div className="space-y-2">
                      <label className="text-sm font-medium">
                        Subcategory <span className="text-gray-400 text-[12px]">(optional)</span>
                      </label>
                      <Select
                        value={selectedSubcategoryId}
                        onValueChange={handleSubcategoryChange}
                        disabled={(() => {
                          const subcategories = subcategoriesMap.get(selectedCategoryId) || [];
                          return subcategories.length === 0;
                        })()}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select a subcategory" />
                        </SelectTrigger>
                        <SelectContent>
                          {(() => {
                            const subcategories = subcategoriesMap.get(selectedCategoryId) || [];
                            return subcategories.length === 0 ? (
                              <div className="p-2 text-sm text-muted-foreground">
                                No subcategories found for this category
                              </div>
                            ) : (
                              subcategories.map((subcategory) => (
                                <SelectItem key={subcategory.id} value={subcategory.id}>
                                  {subcategory.name}
                                </SelectItem>
                              ))
                            );
                          })()}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          <div className="space-y-1">
            <label className="text-sm font-medium">
              Amount {(!form.watch("amount") || form.watch("amount") === 0) && <span className="text-gray-400 text-[12px]">required</span>}
            </label>
            <DollarAmountInput
              value={form.watch("amount") || undefined}
              onChange={(value) => form.setValue("amount", value ?? 0, { shouldValidate: true })}
              placeholder="$ 0.00"
            />
            {form.formState.errors.amount && (
              <p className="text-xs text-destructive">
                {form.formState.errors.amount.message}
              </p>
            )}
          </div>

          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              Cancel
            </Button>
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
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
      )}
    </>
  );
}

