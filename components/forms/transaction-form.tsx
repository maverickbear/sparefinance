"use client";

import { useForm } from "react-hook-form";
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { useEffect, useState } from "react";
import { useToast } from "@/components/toast-provider";
import type { Transaction } from "@/lib/api/transactions-client";
import { LimitWarning } from "@/components/billing/limit-warning";
import { Loader2, Check, ChevronsUpDown } from "lucide-react";
import { DollarAmountInput } from "@/components/common/dollar-amount-input";
import { cn } from "@/lib/utils";

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

interface Category {
  id: string;
  name: string;
  macroId?: string;
  macro?: {
    id: string;
    name: string;
  };
}

interface Subcategory {
  id: string;
  name: string;
  categoryId: string;
}

export function TransactionForm({ open, onOpenChange, transaction, onSuccess, defaultType = "expense" }: TransactionFormProps) {
  const { toast } = useToast();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("");
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [categorySearch, setCategorySearch] = useState("");
  const [transactionLimit, setTransactionLimit] = useState<{ current: number; limit: number } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
      loadData();
      loadTransactionLimit();
      if (transaction) {
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
        if (transaction.categoryId) {
          setSelectedCategoryId(transaction.categoryId);
        }
      } else {
        form.reset({
          date: new Date(),
          type: defaultType,
          amount: 0,
          recurring: false,
        });
        setSelectedCategoryId("");
        setSubcategories([]);
        setCategorySearch("");
      }
    }
  }, [open, transaction]);

  // Load subcategories when category is selected
  useEffect(() => {
    if (open && transaction && transaction.categoryId) {
      loadSubcategoriesForTransaction(transaction);
    }
  }, [open, transaction]);

  // Sync selectedCategoryId with form categoryId when form changes
  const formCategoryId = form.watch("categoryId");
  useEffect(() => {
    setSelectedCategoryId(formCategoryId || "");
  }, [formCategoryId]);

  async function loadData() {
    try {
      const [accountsRes, categoriesRes] = await Promise.all([
        fetch("/api/accounts"),
        fetch("/api/categories?all=true"),
      ]);

      // Check if responses are ok before parsing JSON
      if (!accountsRes.ok) {
        console.error("Error fetching accounts:", accountsRes.status, accountsRes.statusText);
        setAccounts([]);
      } else {
        const accountsData = await accountsRes.json().catch(() => []);
        setAccounts(accountsData);
      }

      if (!categoriesRes.ok) {
        console.error("Error fetching categories:", categoriesRes.status, categoriesRes.statusText);
        setAllCategories([]);
      } else {
        const categoriesData = await categoriesRes.json().catch(() => []);
        // Process categories to ensure macro is properly formatted
        const processedCategories = (categoriesData || []).map((cat: any) => ({
          ...cat,
          // Handle macro - it can be an object, array, or null
          macro: Array.isArray(cat.macro) 
            ? (cat.macro.length > 0 ? cat.macro[0] : null)
            : cat.macro || null,
        }));
        console.log("Loaded categories:", processedCategories.length, "categories");
        console.log("Sample category:", processedCategories[0]);
        setAllCategories(processedCategories);
      }
    } catch (error) {
      console.error("Error loading data:", error);
      setAccounts([]);
      setAllCategories([]);
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
      console.error("Error loading transaction limit:", error);
    }
  }

  async function loadSubcategoriesForTransaction(tx: Transaction) {
    if (!tx.categoryId) return;
    
    setSelectedCategoryId(tx.categoryId);
    try {
      const subcatsRes = await fetch(`/api/categories?categoryId=${tx.categoryId}`);
      if (subcatsRes.ok) {
        const subcats = await subcatsRes.json().catch(() => []);
        setSubcategories(subcats);
      }
    } catch (error) {
      console.error("Error loading subcategories:", error);
    }
  }

  async function handleCategoryChange(categoryId: string) {
    console.log("handleCategoryChange called with:", categoryId);
    setSelectedCategoryId(categoryId);
    form.setValue("categoryId", categoryId);
    form.setValue("subcategoryId", undefined);
    setCategoryOpen(false);
    try {
      const res = await fetch(`/api/categories?categoryId=${categoryId}`);
      if (res.ok) {
        const subcats = await res.json().catch(() => []);
        setSubcategories(subcats);
      } else {
        console.error("Error fetching subcategories:", res.status, res.statusText);
        setSubcategories([]);
      }
    } catch (error) {
      console.error("Error loading subcategories:", error);
      setSubcategories([]);
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
        console.error("API Error:", { status: res.status, statusText: res.statusText, message: errorMessage });
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
      console.error("Error saving transaction:", error);
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
                    setSelectedCategoryId("");
                    setSubcategories([]);
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

            {/* Category and Subcategory row (only for non-transfers) */}
            {form.watch("type") !== "transfer" && (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-sm font-medium">Category</label>
                  <Popover open={categoryOpen} onOpenChange={setCategoryOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={categoryOpen}
                        className="w-full justify-between h-12"
                      >
                        {(() => {
                          const categoryId = formCategoryId || selectedCategoryId;
                          if (categoryId && allCategories.length > 0) {
                            const category = allCategories.find((c) => c.id === categoryId);
                            return category?.name || "Select category...";
                          }
                          return "Select category...";
                        })()}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start" onOpenAutoFocus={(e) => e.preventDefault()}>
                      <Command shouldFilter={false}>
                        <CommandInput 
                          placeholder="Search category..." 
                          value={categorySearch}
                          onValueChange={setCategorySearch}
                        />
                        <CommandList className="max-h-[300px] overflow-y-auto">
                          {(() => {
                            // Group categories by macro
                            const categoriesByMacro = new Map<string, Category[]>();
                            
                            if (allCategories.length === 0) {
                              return <CommandEmpty>No categories available.</CommandEmpty>;
                            }
                            
                            // Filter categories based on search
                            const filteredCategories = categorySearch
                              ? allCategories.filter((cat) =>
                                  cat.name.toLowerCase().includes(categorySearch.toLowerCase())
                                )
                              : allCategories;
                            
                            if (filteredCategories.length === 0) {
                              return <CommandEmpty>No category found.</CommandEmpty>;
                            }
                            
                            filteredCategories.forEach((category) => {
                              // Get macro name - handle different formats from Supabase
                              let macroName = 'Uncategorized';
                              
                              if (category.macro) {
                                // Macro can be an object with name property
                                if (typeof category.macro === 'object' && 'name' in category.macro && !Array.isArray(category.macro)) {
                                  macroName = (category.macro as { name: string }).name;
                                } else if (Array.isArray(category.macro) && category.macro.length > 0) {
                                  macroName = (category.macro[0] as { name?: string })?.name || 'Uncategorized';
                                }
                              } else if (category.macroId) {
                                // If we only have macroId, we can't get the name without another query
                                // For now, use macroId as fallback
                                macroName = category.macroId;
                              }
                              
                              if (!categoriesByMacro.has(macroName)) {
                                categoriesByMacro.set(macroName, []);
                              }
                              categoriesByMacro.get(macroName)!.push(category);
                            });

                            // Sort macros alphabetically
                            const sortedMacros = Array.from(categoriesByMacro.entries()).sort((a, b) => 
                              a[0].localeCompare(b[0])
                            );

                            return sortedMacros.map(([macroName, categories]) => {
                              // Sort categories within each macro alphabetically
                              const sortedCategories = [...categories].sort((a, b) => 
                                a.name.localeCompare(b.name)
                              );
                              
                              return (
                                <CommandGroup key={macroName} heading={macroName}>
                                  {sortedCategories.map((category) => (
                                  <CommandItem
                                    key={category.id}
                                    onSelect={() => {
                                      console.log("CommandItem onSelect triggered:", category.name, category.id);
                                      handleCategoryChange(category.id);
                                    }}
                                    className="cursor-pointer"
                                  >
                                    <Check
                                      className={cn(
                                        "mr-2 h-4 w-4",
                                        selectedCategoryId === category.id ? "opacity-100" : "opacity-0"
                                      )}
                                    />
                                    {category.name}
                                  </CommandItem>
                                  ))}
                                </CommandGroup>
                              );
                            });
                          })()}
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>

                {(subcategories.length > 0 || form.watch("subcategoryId")) && (
                  <div className="space-y-1">
                    <label className="text-sm font-medium">Subcategory</label>
                    <Select
                      value={form.watch("subcategoryId") || undefined}
                      onValueChange={(value) => {
                        if (value) {
                          form.setValue("subcategoryId", value);
                        }
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select subcategory" />
                      </SelectTrigger>
                      <SelectContent>
                        {subcategories.map((subcategory) => (
                          <SelectItem key={subcategory.id} value={subcategory.id}>
                            {subcategory.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
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
  );
}

