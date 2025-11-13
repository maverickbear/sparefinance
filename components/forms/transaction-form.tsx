"use client";

import { useForm } from "react-hook-form";
import { logger } from "@/lib/utils/logger";
import { zodResolver } from "@hookform/resolvers/zod";
import { transactionSchema, TransactionFormData } from "@/lib/validations/transaction";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useEffect, useState } from "react";
import { useToast } from "@/components/toast-provider";
import type { Transaction } from "@/lib/api/transactions-client";
import { LimitWarning } from "@/components/billing/limit-warning";
import { Loader2 } from "lucide-react";
import { DollarAmountInput } from "@/components/common/dollar-amount-input";
import { AccountRequiredDialog } from "@/components/common/account-required-dialog";

interface TransactionFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction?: Transaction | null;
  onSuccess?: () => void;
  defaultType?: "expense" | "income" | "transfer";
}

interface Account {
  id: string;
  name: string;
  type: string;
}

interface Macro {
  id: string;
  name: string;
}

interface Category {
  id: string;
  name: string;
  macroId?: string;
  macro?: {
    id: string;
    name: string;
  };
  subcategories?: Array<{
    id: string;
    name: string;
  }>;
}

interface Subcategory {
  id: string;
  name: string;
  categoryId: string;
}

export function TransactionForm({ open, onOpenChange, transaction, onSuccess, defaultType = "expense" }: TransactionFormProps) {
  const { toast } = useToast();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [macros, setMacros] = useState<Macro[]>([]);
  const [availableCategories, setAvailableCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [selectedMacroId, setSelectedMacroId] = useState<string>("");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("");
  const [subcategoriesMap, setSubcategoriesMap] = useState<Map<string, Array<{ id: string; name: string }>>>(new Map());
  const [transactionLimit, setTransactionLimit] = useState<{ current: number; limit: number } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAccountDialog, setShowAccountDialog] = useState(false);
  const [shouldShowForm, setShouldShowForm] = useState(false);

  const form = useForm<TransactionFormData>({
    resolver: zodResolver(transactionSchema),
    defaultValues: {
      date: new Date(),
      type: "expense",
      amount: 0,
      recurring: false,
    },
  });

  useEffect(() => {
    if (open) {
      // If editing a transaction, no need to check accounts
      if (transaction) {
        setShouldShowForm(true);
        loadData();
        loadTransactionLimit();
        form.reset({
          date: new Date(transaction.date),
          type: transaction.type as "expense" | "income" | "transfer",
          amount: transaction.amount,
          accountId: transaction.accountId,
          toAccountId: (transaction as any).toAccountId || undefined,
          categoryId: transaction.categoryId || undefined,
          subcategoryId: transaction.subcategoryId || undefined,
          description: transaction.description || "",
          recurring: transaction.recurring ?? false,
        });
        // Category will be loaded by the useEffect that handles transaction editing
      } else {
        // If creating a new transaction, check if there are accounts
        checkAccountsAndShowForm();
      }
    } else {
      setShouldShowForm(false);
      setShowAccountDialog(false);
    }
  }, [open, transaction]);

  async function checkAccountsAndShowForm() {
    try {
      const accountsRes = await fetch("/api/accounts");
      if (accountsRes.ok) {
        const accountsData = await accountsRes.json().catch(() => []);
        if (accountsData.length === 0) {
          // No accounts, show the dialog
          setShowAccountDialog(true);
          setShouldShowForm(false);
        } else {
          // Has accounts, can show the form
          setShouldShowForm(true);
          loadData();
          loadTransactionLimit();
          form.reset({
            date: new Date(),
            type: defaultType,
            amount: 0,
            recurring: false,
          });
          setSelectedMacroId("");
          setSelectedCategoryId("");
          setAvailableCategories([]);
          setSubcategories([]);
          setSubcategoriesMap(new Map());
        }
      } else {
        // Error fetching accounts, try to show the form anyway
        setShouldShowForm(true);
        loadData();
        loadTransactionLimit();
      }
    } catch (error) {
      console.error("Error checking accounts:", error);
      // In case of error, try to show the form anyway
      setShouldShowForm(true);
      loadData();
      loadTransactionLimit();
    }
  }

  // Load macros when form opens
  useEffect(() => {
    if (open) {
      loadMacros();
    }
  }, [open]);

  // Load categories when macro is selected
  useEffect(() => {
    if (selectedMacroId && open) {
      loadCategoriesForMacro(selectedMacroId);
    } else if (!selectedMacroId) {
      setAvailableCategories([]);
      setSubcategories([]);
      setSubcategoriesMap(new Map());
    }
  }, [selectedMacroId, open]);

  // Load subcategories when category is selected
  useEffect(() => {
    if (selectedCategoryId && open) {
      loadSubcategoriesForCategory(selectedCategoryId);
    } else if (!selectedCategoryId) {
      setSubcategories([]);
      form.setValue("subcategoryId", undefined);
    }
  }, [selectedCategoryId, open]);

  async function loadData() {
    try {
      const accountsRes = await fetch("/api/accounts");
      
      if (!accountsRes.ok) {
        logger.error("Error fetching accounts:", accountsRes.status, accountsRes.statusText);
        setAccounts([]);
      } else {
        const accountsData = await accountsRes.json().catch(() => []);
        setAccounts(accountsData);
      }
    } catch (error) {
      logger.error("Error loading data:", error);
      setAccounts([]);
    }
  }

  async function loadMacros() {
    try {
      const res = await fetch("/api/categories");
      if (res.ok) {
        const macrosData = await res.json().catch(() => []);
        setMacros(macrosData || []);
      }
    } catch (error) {
      logger.error("Error loading macros:", error);
      setMacros([]);
    }
  }

  async function loadCategoriesForMacro(macroId: string) {
    try {
      const res = await fetch(`/api/categories?macroId=${macroId}`);
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
            const subRes = await fetch(`/api/categories?categoryId=${category.id}`);
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

  async function loadTransactionLimit() {
    try {
      const { getBillingLimitsAction } = await import("@/lib/actions/billing");
      const limits = await getBillingLimitsAction();
      if (limits?.transactionLimit) {
        setTransactionLimit({
          current: limits.transactionLimit.current,
          limit: limits.transactionLimit.limit,
        });
      }
    } catch (error) {
      logger.error("Error loading transaction limit:", error);
    }
  }

  async function loadSubcategoriesForCategory(categoryId: string) {
    try {
      const subcategories = subcategoriesMap.get(categoryId);
      if (subcategories && subcategories.length > 0) {
        setSubcategories(subcategories);
      } else {
        // Fetch if not in map
        const res = await fetch(`/api/categories?categoryId=${categoryId}`);
        if (res.ok) {
          const subcats = await res.json().catch(() => []);
          setSubcategories(subcats);
          // Update map
          if (subcats && subcats.length > 0) {
            setSubcategoriesMap(prev => new Map(prev).set(categoryId, subcats));
          }
        } else {
          setSubcategories([]);
        }
      }
    } catch (error) {
      logger.error("Error loading subcategories:", error);
      setSubcategories([]);
    }
  }

  // Initialize form when editing a transaction
  useEffect(() => {
    if (open && transaction && transaction.categoryId) {
      // Find the category to get its macro
      const findCategoryAndLoad = async () => {
        try {
          // First, load all categories to find the one we need
          const res = await fetch("/api/categories?all=true");
          if (res.ok) {
            const allCats = await res.json().catch(() => []);
            const category = allCats.find((c: Category) => c.id === transaction.categoryId);
            if (category) {
              const macroId = category.macroId || (category.macro ? (Array.isArray(category.macro) ? category.macro[0]?.id : category.macro.id) : null);
              if (macroId) {
                setSelectedMacroId(macroId);
                await loadCategoriesForMacro(macroId);
              }
              setSelectedCategoryId(transaction.categoryId);
              if (transaction.subcategoryId) {
                await loadSubcategoriesForCategory(transaction.categoryId);
              }
            }
          }
        } catch (error) {
          console.error("Error initializing category:", error);
        }
      };
      findCategoryAndLoad();
    }
  }, [open, transaction]);

  function handleMacroChange(macroId: string) {
    setSelectedMacroId(macroId);
    setSelectedCategoryId("");
    setAvailableCategories([]);
    setSubcategories([]);
    setSubcategoriesMap(new Map());
    form.setValue("categoryId", "");
    form.setValue("subcategoryId", undefined);
  }

  function handleCategoryChange(categoryId: string) {
    setSelectedCategoryId(categoryId);
    form.setValue("categoryId", categoryId);
    form.setValue("subcategoryId", undefined);
    // Load subcategories for the selected category
    if (categoryId) {
      loadSubcategoriesForCategory(categoryId);
    } else {
      setSubcategories([]);
    }
  }

  function handleSubcategoryChange(subcategoryId: string) {
    if (subcategoryId && subcategoryId !== "") {
      form.setValue("subcategoryId", subcategoryId);
    } else {
      form.setValue("subcategoryId", undefined);
    }
  }

  async function onSubmit(data: TransactionFormData) {
    try {
      setIsSubmitting(true);
      // Check limit before creating (only for new transactions)
      if (!transaction && transactionLimit) {
        if (transactionLimit.limit !== -1 && transactionLimit.current >= transactionLimit.limit) {
          toast({
            title: "Limit Reached",
            description: `You've reached your monthly transaction limit (${transactionLimit.limit}). Upgrade your plan to continue adding transactions.`,
            variant: "destructive",
          });
          setIsSubmitting(false);
          return;
        }
      }

      const url = transaction ? `/api/transactions/${transaction.id}` : "/api/transactions";
      const method = transaction ? "PATCH" : "POST";
      
      // Serialize data for API - convert Date to ISO string
      const payload = {
        ...data,
        date: data.date instanceof Date ? data.date.toISOString() : data.date,
      };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        let errorMessage = "Failed to save transaction";
        try {
          const errorData = await res.json();
          errorMessage = errorData.error || errorMessage;
        } catch (parseError) {
          // If response is not JSON, try to get text
          try {
            const text = await res.text();
            errorMessage = text || errorMessage;
          } catch (textError) {
            // If all else fails, use status text
            errorMessage = res.statusText || errorMessage;
          }
        }
        logger.error("API Error:", { status: res.status, statusText: res.statusText, message: errorMessage });
        throw new Error(errorMessage);
      }

      // Close form and reset only after successful save
      onOpenChange(false);
      form.reset();

      toast({
        title: transaction ? "Transaction updated" : "Transaction created",
        description: transaction ? "Your transaction has been updated successfully." : "Your transaction has been created successfully.",
        variant: "success",
      });

      // Reload transactions after successful save
      onSuccess?.();
    } catch (error) {
      logger.error("Error saving transaction:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save transaction",
        variant: "destructive",
      });
      // Reload limit after error
      loadTransactionLimit();
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
          <DialogContent className="sm:max-w-2xl sm:max-h-[90vh] flex flex-col !p-0 !gap-0">
        <DialogHeader>
          <DialogTitle>{transaction ? "Edit" : "Add"} Transaction</DialogTitle>
          <DialogDescription>
            {transaction ? "Update the transaction details" : "Create a new transaction"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
          {/* Show limit warning for new transactions */}
          {!transaction && transactionLimit && transactionLimit.limit !== -1 && (
            <LimitWarning
              current={transactionLimit.current}
              limit={transactionLimit.limit}
              type="transactions"
            />
          )}
          <div className="space-y-4">
            {/* Date and Type row */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1">
                <label className="text-sm font-medium">
                  Date
                </label>
                <Input
                  type="date"
                  {...form.register("date", { valueAsDate: true })}
                  value={
                    form.watch("date") && form.watch("date") instanceof Date && !isNaN(form.watch("date").getTime())
                      ? form.watch("date").toISOString().split("T")[0]
                      : ""
                  }
                  onChange={(e) => {
                    const date = e.target.value ? new Date(e.target.value) : new Date();
                    form.setValue("date", date);
                  }}
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium">
                  Type
                </label>
                <Tabs
                  value={form.watch("type")}
                  onValueChange={(value) => {
                    const newType = value as "expense" | "income" | "transfer";
                    form.setValue("type", newType);
                  // Clear category/subcategory for transfers
                  if (newType === "transfer") {
                    form.setValue("categoryId", undefined);
                    form.setValue("subcategoryId", undefined);
                    setSelectedMacroId("");
                    setSelectedCategoryId("");
                    setAvailableCategories([]);
                    setSubcategories([]);
                    setSubcategoriesMap(new Map());
                  }
                  }}
                  className="w-full"
                >
                  <TabsList className="h-12 w-full grid grid-cols-3">
                    <TabsTrigger value="expense" className="text-sm">Expense</TabsTrigger>
                    <TabsTrigger value="income" className="text-sm">Income</TabsTrigger>
                    <TabsTrigger value="transfer" className="text-sm">Transfer</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            </div>

            {/* Amount and Account row */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1">
                <label className="text-sm font-medium">
                  Amount
                </label>
                <DollarAmountInput
                  value={form.watch("amount") || undefined}
                  onChange={(value) => form.setValue("amount", value ?? 0, { shouldValidate: true })}
                  placeholder="$ 0.00"
                  required
                />
                {form.formState.errors.amount && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.amount.message}
                  </p>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium">
                  {form.watch("type") === "transfer" ? "From Account" : "Account"}
                </label>
                <Select
                  value={form.watch("accountId")}
                  onValueChange={(value) => form.setValue("accountId", value)}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select account" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* To Account (only for transfers) */}
            {form.watch("type") === "transfer" && (
              <div className="space-y-1">
                <label className="text-sm font-medium">
                  To Account
                </label>
                <Select
                  value={form.watch("toAccountId") || ""}
                  onValueChange={(value) => form.setValue("toAccountId", value)}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select destination account" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts
                      .filter((account) => account.id !== form.watch("accountId"))
                      .map((account) => (
                        <SelectItem key={account.id} value={account.id}>
                          {account.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                {form.formState.errors.toAccountId && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.toAccountId.message}
                  </p>
                )}
              </div>
            )}

            {/* Group, Category and Subcategory (only for non-transfers) */}
            {form.watch("type") !== "transfer" && (
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-1">
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

                <div className="space-y-1">
                  <label className="text-sm font-medium">
                    Category {!selectedCategoryId && <span className="text-gray-400 text-[12px]">required</span>}
                  </label>
                  <Select
                    value={selectedCategoryId}
                    onValueChange={handleCategoryChange}
                    disabled={!selectedMacroId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a category" />
                    </SelectTrigger>
                    <SelectContent>
                      {!selectedMacroId ? (
                        <div className="p-2 text-sm text-muted-foreground">
                          Select a group first
                        </div>
                      ) : availableCategories.length === 0 ? (
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

                <div className="space-y-1">
                  <label className="text-sm font-medium">
                    Subcategory <span className="text-gray-400 text-[12px]">(optional)</span>
                  </label>
                  <Select
                    value={form.watch("subcategoryId") || undefined}
                    onValueChange={handleSubcategoryChange}
                    disabled={!selectedCategoryId || (() => {
                      const subcats = subcategoriesMap.get(selectedCategoryId) || [];
                      return subcats.length === 0;
                    })()}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a subcategory" />
                    </SelectTrigger>
                    <SelectContent>
                      {(() => {
                        if (!selectedCategoryId) {
                          return (
                            <div className="p-2 text-sm text-muted-foreground">
                              Select a category first
                            </div>
                          );
                        }
                        const subcats = subcategoriesMap.get(selectedCategoryId) || [];
                        return subcats.length === 0 ? (
                          <div className="p-2 text-sm text-muted-foreground">
                            No subcategories found for this category
                          </div>
                        ) : (
                          subcats.map((subcategory) => (
                            <SelectItem key={subcategory.id} value={subcategory.id}>
                              {subcategory.name}
                            </SelectItem>
                          ))
                        );
                      })()}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            <div className="space-y-1">
              <label className="text-sm font-medium">Description</label>
              <Input {...form.register("description")} />
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="recurring"
                checked={form.watch("recurring")}
                onCheckedChange={(checked) => form.setValue("recurring", checked === true)}
              />
              <label
                htmlFor="recurring"
                className="text-sm font-medium cursor-pointer flex items-center"
              >
                Recurring (occurs every month)
              </label>
            </div>
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

