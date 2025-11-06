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

interface Transaction {
  id: string;
  date: string;
  type: string;
  amount: number;
  accountId: string;
  categoryId?: string;
  subcategoryId?: string;
  description?: string;
  tags?: string;
  transferToId?: string;
  recurring?: boolean;
  category?: {
    id: string;
    name: string;
    macroId?: string;
  };
}

interface TransactionFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction?: Transaction | null;
  onSuccess?: () => void;
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
  macroId: string;
}

interface Subcategory {
  id: string;
  name: string;
  categoryId: string;
}

export function TransactionForm({ open, onOpenChange, transaction, onSuccess }: TransactionFormProps) {
  const { toast } = useToast();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [macros, setMacros] = useState<Macro[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [selectedMacroId, setSelectedMacroId] = useState<string>("");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("");

  const form = useForm<TransactionFormData>({
    resolver: zodResolver(transactionSchema),
    defaultValues: {
      date: new Date(),
      type: "expense",
      amount: 0,
      tags: [],
      recurring: false,
    },
  });

  useEffect(() => {
    if (open) {
      loadData();
      if (transaction) {
        form.reset({
          date: new Date(transaction.date),
          type: transaction.type as "expense" | "income" | "transfer",
          amount: transaction.amount,
          accountId: transaction.accountId,
          categoryId: transaction.categoryId,
          subcategoryId: transaction.subcategoryId,
          description: transaction.description || "",
          tags: transaction.tags ? JSON.parse(transaction.tags) : [],
          transferToId: transaction.transferToId,
          recurring: transaction.recurring ?? false,
        });
      } else {
        form.reset({
          date: new Date(),
          type: "expense",
          amount: 0,
          tags: [],
          recurring: false,
        });
        setSelectedMacroId("");
        setSelectedCategoryId("");
        setCategories([]);
        setSubcategories([]);
      }
    }
  }, [open, transaction]);

  // Load categories after macros are loaded
  useEffect(() => {
    if (open && transaction && transaction.categoryId && macros.length > 0) {
      loadCategoriesForTransaction(transaction);
    }
  }, [macros, open, transaction]);

  async function loadData() {
    try {
      const [accountsRes, macrosRes] = await Promise.all([
        fetch("/api/accounts"),
        fetch("/api/categories"),
      ]);
      const [accountsData, macrosData] = await Promise.all([
        accountsRes.json(),
        macrosRes.json(),
      ]);
      setAccounts(accountsData);
      setMacros(macrosData);
    } catch (error) {
      console.error("Error loading data:", error);
    }
  }

  async function loadCategoriesForTransaction(tx: Transaction) {
    if (!tx.categoryId) return;
    
    let macroId: string | undefined;
    
    // Try to get macroId from tx.category first
    if (tx.category && tx.category.macroId) {
      macroId = tx.category.macroId;
    } else {
      // If macro not available, fetch from API
      try {
        const categoryRes = await fetch(`/api/categories/all`);
        const allCategories = await categoryRes.json();
        const category = allCategories.find((c: Category) => c.id === tx.categoryId);
        if (category) {
          if (typeof category.macro === 'object' && category.macro?.id) {
            macroId = category.macro.id;
          } else if (typeof category.macro === 'string') {
            macroId = category.macro;
          } else if (category.macroId) {
            macroId = category.macroId;
          }
        }
      } catch (error) {
        console.error("Error loading category info:", error);
      }
    }
    
    if (macroId) {
      const macro = macros.find((m) => m.id === macroId);
      if (macro) {
        setSelectedMacroId(macro.id);
        const res = await fetch(`/api/categories?macroId=${macroId}`);
        const cats = await res.json();
        setCategories(cats);
        setSelectedCategoryId(tx.categoryId || "");
        if (tx.subcategoryId) {
          const subcatsRes = await fetch(`/api/categories?categoryId=${tx.categoryId}`);
          const subcats = await subcatsRes.json();
          setSubcategories(subcats);
        }
      }
    }
  }

  async function handleMacroChange(macroId: string) {
    setSelectedMacroId(macroId || "");
    try {
      if (macroId) {
        const res = await fetch(`/api/categories?macroId=${macroId}`);
        const cats = await res.json();
        setCategories(cats);
        setSubcategories([]);
        // Only clear category if we're changing macro (not on initial load)
        if (selectedMacroId && selectedMacroId !== macroId) {
          form.setValue("categoryId", undefined);
          form.setValue("subcategoryId", undefined);
        }
      } else {
        setCategories([]);
        setSubcategories([]);
        form.setValue("categoryId", undefined);
        form.setValue("subcategoryId", undefined);
      }
    } catch (error) {
      console.error("Error loading categories:", error);
    }
  }

  async function handleCategoryChange(categoryId: string) {
    setSelectedCategoryId(categoryId);
    try {
      const res = await fetch(`/api/categories?categoryId=${categoryId}`);
      const subcats = await res.json();
      setSubcategories(subcats);
      form.setValue("categoryId", categoryId);
      form.setValue("subcategoryId", undefined);
    } catch (error) {
      console.error("Error loading subcategories:", error);
    }
  }

  async function onSubmit(data: TransactionFormData) {
    try {
      const url = transaction ? `/api/transactions/${transaction.id}` : "/api/transactions";
      const method = transaction ? "PATCH" : "POST";
      
      // Serialize data for API - convert Date to ISO string
      const payload = {
        ...data,
        date: data.date instanceof Date ? data.date.toISOString() : data.date,
      };
      
      // Optimistic update: call onSuccess immediately
      onSuccess?.();
      onOpenChange(false);
      form.reset();

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: "Unknown error" }));
        console.error("API Error:", errorData);
        throw new Error(errorData.error || "Failed to save transaction");
      }

      toast({
        title: transaction ? "Transaction updated" : "Transaction created",
        description: transaction ? "Your transaction has been updated successfully." : "Your transaction has been created successfully.",
        variant: "success",
      });
    } catch (error) {
      console.error("Error saving transaction:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save transaction",
        variant: "destructive",
      });
      // Reload on error to revert optimistic update
      onSuccess?.();
    }
  }

  const isTransfer = form.watch("type") === "transfer";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{transaction ? "Edit" : "Add"} Transaction</DialogTitle>
          <DialogDescription>
            {transaction ? "Update the transaction details" : "Create a new transaction"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1">
              <label className="text-sm font-medium">Date</label>
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
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">Type</label>
              <Select
                value={form.watch("type")}
                onValueChange={(value) => {
                  const newType = value as "expense" | "income" | "transfer";
                  form.setValue("type", newType);
                  
                  // Clear category/subcategory when switching to transfer
                  if (newType === "transfer") {
                    form.setValue("categoryId", undefined);
                    form.setValue("subcategoryId", undefined);
                    setSelectedMacroId("");
                    setCategories([]);
                    setSubcategories([]);
                  }
                  // Clear transferToId when switching away from transfer
                  else if (form.watch("type") === "transfer") {
                    form.setValue("transferToId", undefined);
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="expense">Expense</SelectItem>
                  <SelectItem value="income">Income</SelectItem>
                  <SelectItem value="transfer">Transfer</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">Account</label>
              <Select
                value={form.watch("accountId")}
                onValueChange={(value) => form.setValue("accountId", value)}
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

            {isTransfer && (
              <div className="space-y-1">
                <label className="text-sm font-medium">Transfer To</label>
                <Select
                  value={form.watch("transferToId")}
                  onValueChange={(value) => form.setValue("transferToId", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select account" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts
                      .filter((a) => a.id !== form.watch("accountId"))
                      .map((account) => (
                        <SelectItem key={account.id} value={account.id}>
                          {account.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {!isTransfer && (
              <>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Group</label>
                  <Select 
                    value={selectedMacroId || undefined} 
                    onValueChange={handleMacroChange}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select group" />
                    </SelectTrigger>
                    <SelectContent>
                      {macros.map((macro) => (
                        <SelectItem key={macro.id} value={macro.id}>
                          {macro.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedMacroId && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 text-xs"
                      onClick={() => handleMacroChange("")}
                    >
                      Clear
                    </Button>
                  )}
                </div>

                {(categories.length > 0 || form.watch("categoryId")) && (
                  <div className="space-y-1">
                    <label className="text-sm font-medium">Category</label>
                    <Select
                      value={form.watch("categoryId") || undefined}
                      onValueChange={(value) => {
                        if (value) {
                          handleCategoryChange(value);
                        }
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((category) => (
                          <SelectItem key={category.id} value={category.id}>
                            {category.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {form.watch("categoryId") && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 text-xs"
                        onClick={() => {
                          form.setValue("categoryId", undefined);
                          form.setValue("subcategoryId", undefined);
                          setSelectedCategoryId("");
                          setSubcategories([]);
                        }}
                      >
                        Clear
                      </Button>
                    )}
                  </div>
                )}

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
                    {form.watch("subcategoryId") && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 text-xs"
                        onClick={() => {
                          form.setValue("subcategoryId", undefined);
                        }}
                      >
                        Clear
                      </Button>
                    )}
                  </div>
                )}
              </>
            )}

            <div className="space-y-1">
              <label className="text-sm font-medium">Amount</label>
              <Input
                type="text"
                inputMode="decimal"
                placeholder="0.00"
                {...form.register("amount", { valueAsNumber: true })}
              />
            </div>

            <div className="space-y-1 md:col-span-2">
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

