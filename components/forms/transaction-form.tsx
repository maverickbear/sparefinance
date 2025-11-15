"use client";

import * as React from "react";
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
import { Search, ChevronsUpDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";
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
import { parseDateInput, formatDateInput } from "@/lib/utils/timestamp";

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

// Helper function to format account type for display
function formatAccountType(type: string): string {
  const typeMap: Record<string, string> = {
    checking: "Checking",
    savings: "Savings",
    credit: "Credit Card",
    cash: "Cash",
    investment: "Investment",
    other: "Other",
  };
  return typeMap[type.toLowerCase()] || type;
}


interface Category {
  id: string;
  name: string;
  macroId?: string;
  macro?: {
    id: string;
    name: string;
    type?: "income" | "expense" | null;
  } | null;
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
  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("");
  const [subcategoriesMap, setSubcategoriesMap] = useState<Map<string, Array<{ id: string; name: string }>>>(new Map());
  const [transactionLimit, setTransactionLimit] = useState<{ current: number; limit: number } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAccountDialog, setShowAccountDialog] = useState(false);
  const [shouldShowForm, setShouldShowForm] = useState(false);
  const [categoryComboboxOpen, setCategoryComboboxOpen] = useState(false);
  const [categorySearchQuery, setCategorySearchQuery] = useState("");
  const categoryButtonRef = React.useRef<HTMLButtonElement>(null);
  const categoryDropdownRef = React.useRef<HTMLDivElement>(null);
  const [subcategoryComboboxOpen, setSubcategoryComboboxOpen] = useState(false);
  const [subcategorySearchQuery, setSubcategorySearchQuery] = useState("");
  const subcategoryButtonRef = React.useRef<HTMLButtonElement>(null);
  const subcategoryDropdownRef = React.useRef<HTMLDivElement>(null);

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
        
        // Ensure amount is valid (must be positive)
        const amount = transaction.amount && transaction.amount > 0 ? transaction.amount : 0.01;
        
        // Ensure accountId exists
        if (!transaction.accountId) {
          console.error("[TransactionForm] Transaction missing accountId", transaction);
          // Don't show toast in useEffect, it will be handled when form is submitted
        }
        
        console.log("[TransactionForm] Resetting form with transaction data", {
          transactionId: transaction.id,
          amount,
          accountId: transaction.accountId,
          type: transaction.type,
        });
        
        const formData: any = {
          date: new Date(transaction.date),
          type: transaction.type as "expense" | "income" | "transfer",
          amount: amount,
          accountId: transaction.accountId || "",
          toAccountId: (transaction as any).toAccountId || undefined,
          categoryId: transaction.categoryId || undefined,
          subcategoryId: transaction.subcategoryId || undefined,
          description: transaction.description || "",
          recurring: transaction.recurring ?? false,
        };
        
        // Only include expenseType if type is expense and it has a value
        if (transaction.type === "expense" && transaction.expenseType) {
          formData.expenseType = transaction.expenseType as "fixed" | "variable";
        }
        
        console.log("[TransactionForm] Form data to reset", formData);
        
        form.reset(formData);
        
        // Trigger validation after reset to show any errors immediately
        setTimeout(() => {
          form.trigger();
        }, 100);
        // Category will be loaded by the useEffect that handles transaction editing
      } else {
        // If creating a new transaction, check if there are accounts
        checkAccountsAndShowForm();
      }
    } else {
      setShouldShowForm(false);
      setShowAccountDialog(false);
      setCategoryComboboxOpen(false);
      setCategorySearchQuery("");
      setSubcategoryComboboxOpen(false);
      setSubcategorySearchQuery("");
    }
  }, [open, transaction]);

  // Close dropdowns when clicking outside
  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      
      if (
        categoryComboboxOpen &&
        categoryButtonRef.current &&
        !categoryButtonRef.current.contains(target) &&
        categoryDropdownRef.current &&
        !categoryDropdownRef.current.contains(target)
      ) {
        setCategoryComboboxOpen(false);
      }
      
      if (
        subcategoryComboboxOpen &&
        subcategoryButtonRef.current &&
        !subcategoryButtonRef.current.contains(target) &&
        subcategoryDropdownRef.current &&
        !subcategoryDropdownRef.current.contains(target)
      ) {
        setSubcategoryComboboxOpen(false);
      }
    }

    if (categoryComboboxOpen || subcategoryComboboxOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [categoryComboboxOpen, subcategoryComboboxOpen]);

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
          setSelectedCategoryId("");
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

  // Load macros when form opens or type changes
  // Load all categories when form opens or type changes
  useEffect(() => {
    if (open) {
      loadAllCategories();
    }
  }, [open, form.watch("type")]);

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

  async function loadAllCategories() {
    try {
      const res = await fetch("/api/categories?all=true");
      if (!res.ok) {
        throw new Error("Failed to fetch categories");
      }
      const categories = await res.json();
      
      // Handle relations (ensure consistent format)
      const formattedCategories = (categories || []).map((cat: any) => ({
        ...cat,
        macro: Array.isArray(cat.macro) ? (cat.macro.length > 0 ? cat.macro[0] : null) : cat.macro,
        subcategories: Array.isArray(cat.subcategories) ? cat.subcategories : [],
      }));
      
      setAllCategories(formattedCategories);
      
      // Load subcategories for all categories
      const newSubcategoriesMap = new Map<string, Array<{ id: string; name: string }>>();
      for (const category of formattedCategories) {
        if (category.subcategories && category.subcategories.length > 0) {
          newSubcategoriesMap.set(category.id, category.subcategories.map((sub: any) => ({
            id: sub.id,
            name: sub.name,
          })));
        }
      }
      setSubcategoriesMap(newSubcategoriesMap);
    } catch (error) {
      logger.error("Error loading categories:", error);
      setAllCategories([]);
      setSubcategoriesMap(new Map());
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
      setSelectedCategoryId(transaction.categoryId);
      form.setValue("categoryId", transaction.categoryId);
      if (transaction.subcategoryId) {
        loadSubcategoriesForCategory(transaction.categoryId);
      }
    }
  }, [open, transaction]);

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

  async function saveTransaction(data: TransactionFormData, closeDialog: boolean = true) {
    try {
      console.log("[TransactionForm] saveTransaction called", { 
        isEditing: !!transaction, 
        transactionId: transaction?.id,
        data,
        closeDialog
      });
      
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
      // Remove expenseType if type is not expense (to avoid sending null)
      const payload: any = {
        ...data,
        date: data.date instanceof Date ? data.date.toISOString() : data.date,
      };
      
      // Only include expenseType if type is expense
      if (data.type !== "expense") {
        delete payload.expenseType;
      } else if (payload.expenseType === null || payload.expenseType === undefined) {
        // If expense but expenseType is null/undefined, remove it
        delete payload.expenseType;
      }

      console.log("[TransactionForm] Sending request", { url, method, payload });

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      console.log("[TransactionForm] Response received", { status: res.status, ok: res.ok });

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

      toast({
        title: transaction ? "Transaction updated" : "Transaction created",
        description: transaction ? "Your transaction has been updated successfully." : "Your transaction has been created successfully.",
        variant: "success",
      });

      // Reload transactions after successful save
      // Call onSuccess immediately and also after a delay to ensure cache is cleared
      console.log("[TransactionForm] Calling onSuccess to reload transactions");
      onSuccess?.();
      
      // Also call after a short delay to ensure the API cache is cleared
      setTimeout(() => {
        console.log("[TransactionForm] Calling onSuccess again after delay");
        onSuccess?.();
      }, 500);

      // If closeDialog is true, close the form and reset
      if (closeDialog) {
        onOpenChange(false);
        form.reset();
      } else {
        // Reset form but keep dialog open
        form.reset({
          date: new Date(),
          type: defaultType,
          amount: 0,
          recurring: false,
        });
        setSelectedCategoryId("");
        setSubcategories([]);
        setSubcategoriesMap(new Map());
        // Reload transaction limit for next transaction
        loadTransactionLimit();
      }
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

  async function onSubmit(data: TransactionFormData) {
    await saveTransaction(data, true);
  }

  async function onSubmitAndNew(data: TransactionFormData) {
    await saveTransaction(data, false);
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

        <form 
          onSubmit={(e) => {
            console.log("[TransactionForm] Form submit event", { 
              formState: form.formState,
              errors: form.formState.errors,
              values: form.getValues()
            });
            e.preventDefault();
            form.handleSubmit(onSubmit, (errors) => {
              console.log("[TransactionForm] Validation errors", errors);
              
              // Build detailed error message
              const errorMessages = Object.entries(errors).map(([field, error]) => {
                if (error && 'message' in error) {
                  return `${field}: ${error.message}`;
                }
                return `${field}: Invalid value`;
              });
              
              const errorMessage = errorMessages.length > 0 
                ? errorMessages.join(', ')
                : "Please check the form fields and try again.";
              
              toast({
                title: "Validation Error",
                description: errorMessage,
                variant: "destructive",
              });
            })(e);
          }} 
          className="flex flex-col flex-1 overflow-hidden"
        >
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
                  className="h-12"
                  {...form.register("date", { valueAsDate: true })}
                  value={formatDateInput(form.watch("date"))}
                  onChange={(e) => {
                    const date = e.target.value ? parseDateInput(e.target.value) : new Date();
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
                    setSubcategoriesMap(new Map());
                    setCategoryComboboxOpen(false);
                    setCategorySearchQuery("");
                    setSubcategoryComboboxOpen(false);
                    setSubcategorySearchQuery("");
                  } else {
                    // When switching between expense and income, clear selected category if its group doesn't match the new type
                    const currentCategory = allCategories.find(c => c.id === selectedCategoryId);
                    if (currentCategory) {
                      const categoryGroup = currentCategory.macro || (Array.isArray(currentCategory.macro) ? currentCategory.macro[0] : null);
                      if (categoryGroup) {
                        const shouldKeepCategory = 
                          (newType === "expense" && (categoryGroup.type === "expense" || categoryGroup.type === null)) ||
                          (newType === "income" && (categoryGroup.type === "income" || categoryGroup.type === null));
                        
                        if (!shouldKeepCategory) {
                          // Clear category and related fields if its group doesn't match the new type
                          setSelectedCategoryId("");
                          form.setValue("categoryId", undefined);
                          form.setValue("subcategoryId", undefined);
                          setSubcategories([]);
                          setSubcategoriesMap(new Map());
                          setCategoryComboboxOpen(false);
                          setCategorySearchQuery("");
                          setSubcategoryComboboxOpen(false);
                          setSubcategorySearchQuery("");
                        }
                      }
                    }
                  }
                  // Clear expenseType if not expense
                  if (newType !== "expense") {
                    form.setValue("expenseType", undefined, { shouldValidate: false });
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
                  onChange={(value) => {
                    const numValue = value ?? 0;
                    form.setValue("amount", numValue > 0 ? numValue : 0.01, { shouldValidate: true });
                  }}
                  placeholder="$ 0.00"
                  className="h-12"
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
                  value={form.watch("accountId") || ""}
                  onValueChange={(value) => {
                    form.setValue("accountId", value, { shouldValidate: true });
                  }}
                  required
                >
                  <SelectTrigger className="h-12">
                    <SelectValue placeholder="Select account" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.name} ({formatAccountType(account.type)})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.formState.errors.accountId && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.accountId.message}
                  </p>
                )}
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
                  <SelectTrigger className="h-12">
                    <SelectValue placeholder="Select destination account" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts
                      .filter((account) => account.id !== form.watch("accountId"))
                      .map((account) => (
                        <SelectItem key={account.id} value={account.id}>
                          {account.name} ({formatAccountType(account.type)})
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

            {/* Category and Subcategory (only for non-transfers) */}
            {form.watch("type") !== "transfer" && (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1 relative">
                  <label className="text-sm font-medium">
                    Category {!selectedCategoryId && <span className="text-gray-400 text-[12px]">required</span>}
                  </label>
                  <Button
                    type="button"
                    ref={categoryButtonRef}
                    variant="outline"
                    role="combobox"
                    aria-expanded={categoryComboboxOpen}
                    className="h-12 w-full justify-between"
                    onClick={() => setCategoryComboboxOpen(!categoryComboboxOpen)}
                  >
                    {selectedCategoryId
                      ? allCategories.find((cat) => cat.id === selectedCategoryId)?.name || "Select a category"
                      : "Select a category"}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                  {categoryComboboxOpen && (
                    <div 
                      ref={categoryDropdownRef}
                      className="absolute w-full mt-1 bg-popover border rounded-[12px] shadow-lg"
                      style={{ maxHeight: '235px', display: 'flex', flexDirection: 'column', zIndex: 9999 }}
                      onMouseDown={(e) => e.preventDefault()}
                    >
                      {/* Search Input */}
                      <div className="flex items-center border-b px-3 h-11 flex-shrink-0">
                        <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                        <Input
                          placeholder="Search categories..."
                          value={categorySearchQuery}
                          onChange={(e) => setCategorySearchQuery(e.target.value)}
                          className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 h-full"
                          onKeyDown={(e) => {
                            if (e.key === "Escape") {
                              setCategoryComboboxOpen(false);
                            }
                          }}
                          autoFocus
                        />
                      </div>
                      {/* Categories List - Grouped by Group */}
                      <div className="p-1 overflow-y-auto overflow-x-hidden" style={{ height: '184px' }}>
                        {(() => {
                          const transactionType = form.watch("type");
                          
                          // Filter categories by transaction type (based on group type)
                          const filteredCategories = allCategories.filter((category) => {
                            const categoryGroup = category.macro || (Array.isArray(category.macro) ? category.macro[0] : null);
                            if (!categoryGroup) return false;
                            
                            // Filter by transaction type
                            if (transactionType === "expense") {
                              if (categoryGroup.type !== "expense" && categoryGroup.type !== null) return false;
                            } else if (transactionType === "income") {
                              if (categoryGroup.type !== "income" && categoryGroup.type !== null) return false;
                            }
                            
                            // Filter by search query
                            if (categorySearchQuery.trim()) {
                              return category.name.toLowerCase().includes(categorySearchQuery.toLowerCase()) ||
                                     categoryGroup.name.toLowerCase().includes(categorySearchQuery.toLowerCase());
                            }
                            return true;
                          });

                          if (filteredCategories.length === 0) {
                            return (
                              <div className="py-6 text-center text-sm text-muted-foreground">
                                No categories found.
                              </div>
                            );
                          }

                          // Group categories by Group
                          const groupedByGroup = new Map<string, { group: any; categories: Category[] }>();
                          filteredCategories.forEach((category) => {
                            const categoryGroup = category.macro || (Array.isArray(category.macro) ? category.macro[0] : null);
                            if (categoryGroup) {
                              const groupId = categoryGroup.id;
                              if (!groupedByGroup.has(groupId)) {
                                groupedByGroup.set(groupId, { group: categoryGroup, categories: [] });
                              }
                              groupedByGroup.get(groupId)!.categories.push(category);
                            }
                          });

                          return (
                            <div className="space-y-2">
                              {Array.from(groupedByGroup.entries()).map(([groupId, { group, categories }]) => (
                                <div key={groupId} className="space-y-1">
                                  <div className="px-2 py-1 text-xs font-semibold text-muted-foreground uppercase">
                                    {group.name}
                                  </div>
                                  {categories.map((category) => (
                                    <button
                                      key={category.id}
                                      type="button"
                                      onClick={() => {
                                        handleCategoryChange(category.id);
                                        setCategoryComboboxOpen(false);
                                        setCategorySearchQuery("");
                                      }}
                                      className={cn(
                                        "w-full flex items-center rounded-md px-2 py-1.5 text-sm text-left cursor-pointer transition-colors pl-6",
                                        "hover:bg-accent hover:text-accent-foreground",
                                        selectedCategoryId === category.id && "bg-accent text-accent-foreground"
                                      )}
                                    >
                                      <Check
                                        className={cn(
                                          "mr-2 h-4 w-4 shrink-0",
                                          selectedCategoryId === category.id ? "opacity-100" : "opacity-0"
                                        )}
                                      />
                                      {category.name}
                                    </button>
                                  ))}
                                </div>
                              ))}
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  )}
                  {form.formState.errors.categoryId && (
                    <p className="text-xs text-destructive">
                      {form.formState.errors.categoryId.message}
                    </p>
                  )}
                </div>

                <div className="space-y-1 relative">
                  <label className="text-sm font-medium">
                    Subcategory <span className="text-gray-400 text-[12px]">(optional)</span>
                  </label>
                  {(() => {
                    const subcats = selectedCategoryId ? subcategoriesMap.get(selectedCategoryId) || [] : [];
                    const isDisabled = !selectedCategoryId || subcats.length === 0;
                    const selectedSubcategoryId = form.watch("subcategoryId");
                    const selectedSubcategory = subcats.find((s) => s.id === selectedSubcategoryId);
                    
                    return (
                      <>
                        <Button
                          type="button"
                          ref={subcategoryButtonRef}
                          variant="outline"
                          role="combobox"
                          aria-expanded={subcategoryComboboxOpen}
                          className="h-12 w-full justify-between"
                          onClick={() => setSubcategoryComboboxOpen(!subcategoryComboboxOpen)}
                          disabled={isDisabled}
                        >
                          {selectedSubcategory
                            ? selectedSubcategory.name
                            : "Select a subcategory"}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                        {subcategoryComboboxOpen && !selectedCategoryId && (
                          <div 
                            ref={subcategoryDropdownRef}
                            className="absolute w-full mt-1 bg-popover border rounded-[12px] shadow-lg p-2"
                            style={{ zIndex: 9999 }}
                            onMouseDown={(e) => e.preventDefault()}
                          >
                            <div className="text-sm text-muted-foreground">
                              Select a category first
                            </div>
                          </div>
                        )}
                        {subcategoryComboboxOpen && selectedCategoryId && subcats.length === 0 && (
                          <div 
                            ref={subcategoryDropdownRef}
                            className="absolute w-full mt-1 bg-popover border rounded-[12px] shadow-lg p-2"
                            style={{ zIndex: 9999 }}
                            onMouseDown={(e) => e.preventDefault()}
                          >
                            <div className="text-sm text-muted-foreground">
                              No subcategories found for this category
                            </div>
                          </div>
                        )}
                        {subcategoryComboboxOpen && selectedCategoryId && subcats.length > 0 && (
                          <div 
                            ref={subcategoryDropdownRef}
                            className="absolute w-full mt-1 bg-popover border rounded-[12px] shadow-lg"
                            style={{ maxHeight: '235px', display: 'flex', flexDirection: 'column', zIndex: 9999 }}
                            onMouseDown={(e) => e.preventDefault()}
                          >
                            {/* Search Input */}
                            <div className="flex items-center border-b px-3 h-11 flex-shrink-0">
                              <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                              <Input
                                placeholder="Search subcategories..."
                                value={subcategorySearchQuery}
                                onChange={(e) => setSubcategorySearchQuery(e.target.value)}
                                className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 h-full"
                                onKeyDown={(e) => {
                                  if (e.key === "Escape") {
                                    setSubcategoryComboboxOpen(false);
                                  }
                                }}
                                autoFocus
                              />
                            </div>
                            {/* Subcategories List */}
                            <div className="p-1 overflow-y-auto overflow-x-hidden" style={{ height: '184px' }}>
                              <div className="space-y-1">
                                {subcats
                                  .filter((subcategory) => {
                                    if (subcategorySearchQuery.trim()) {
                                      return subcategory.name.toLowerCase().includes(subcategorySearchQuery.toLowerCase());
                                    }
                                    return true;
                                  })
                                  .map((subcategory) => (
                                    <button
                                      key={subcategory.id}
                                      type="button"
                                      onClick={() => {
                                        handleSubcategoryChange(subcategory.id);
                                        setSubcategoryComboboxOpen(false);
                                        setSubcategorySearchQuery("");
                                      }}
                                      className={cn(
                                        "w-full flex items-center rounded-md px-2 py-1.5 text-sm text-left cursor-pointer transition-colors",
                                        "hover:bg-accent hover:text-accent-foreground",
                                        selectedSubcategoryId === subcategory.id && "bg-accent text-accent-foreground"
                                      )}
                                    >
                                      <Check
                                        className={cn(
                                          "mr-2 h-4 w-4 shrink-0",
                                          selectedSubcategoryId === subcategory.id ? "opacity-100" : "opacity-0"
                                        )}
                                      />
                                      {subcategory.name}
                                    </button>
                                  ))}
                              </div>
                            </div>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>
            )}

            <div className="space-y-1">
              <label className="text-sm font-medium">Description</label>
              <Input className="h-12" {...form.register("description")} />
            </div>

            {/* Expense Type (only for expense transactions) */}
            {form.watch("type") === "expense" && (
              <div className="space-y-3">
                <label className="text-sm font-medium">
                  Expense Type <span className="text-gray-400 text-[12px]">(optional)</span>
                </label>
                <div className="flex gap-6">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="radio"
                      name="expenseType"
                      value="variable"
                      checked={form.watch("expenseType") === "variable"}
                      onChange={() => {
                        form.setValue("expenseType", "variable");
                      }}
                      className="w-4 h-4 text-primary border-gray-300 focus:ring-primary"
                    />
                    <span className="text-sm">Variable</span>
                  </label>
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="radio"
                      name="expenseType"
                      value="fixed"
                      checked={form.watch("expenseType") === "fixed"}
                      onChange={() => {
                        form.setValue("expenseType", "fixed");
                      }}
                      className="w-4 h-4 text-primary border-gray-300 focus:ring-primary"
                    />
                    <span className="text-sm">Fixed</span>
                  </label>
                </div>
              </div>
            )}

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
            {!transaction && (
              <Button 
                type="button" 
                variant="outline"
                disabled={isSubmitting}
                onClick={(e) => {
                  e.preventDefault();
                  form.handleSubmit(onSubmitAndNew, (errors) => {
                    console.log("[TransactionForm] Validation errors", errors);
                    
                    // Build detailed error message
                    const errorMessages = Object.entries(errors).map(([field, error]) => {
                      if (error && 'message' in error) {
                        return `${field}: ${error.message}`;
                      }
                      return `${field}: Invalid value`;
                    });
                    
                    const errorMessage = errorMessages.length > 0 
                      ? errorMessages.join(', ')
                      : "Please check the form fields and try again.";
                    
                    toast({
                      title: "Validation Error",
                      description: errorMessage,
                      variant: "destructive",
                    });
                  })();
                }}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save and New"
                )}
              </Button>
            )}
            <Button 
              type="submit" 
              disabled={isSubmitting}
            >
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

