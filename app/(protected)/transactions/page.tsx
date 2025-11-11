"use client";

import { useState, useEffect, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TransactionForm } from "@/components/forms/transaction-form";
import { CsvImportDialog } from "@/components/forms/csv-import-dialog";
import { CategorySelectionModal } from "@/components/transactions/category-selection-modal";
import { formatMoney } from "@/components/common/money";
import { Plus, Download, Upload, Search, Trash2, Edit, Repeat, Check, Loader2, X, Clock, Receipt } from "lucide-react";
import { EmptyState } from "@/components/common/empty-state";
import { TransactionsMobileCard } from "@/components/transactions/transactions-mobile-card";
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
import { Input } from "@/components/ui/input";
import { format } from "date-fns";
import { getAccounts } from "@/lib/api/accounts";
import { getAllCategories } from "@/lib/api/categories";
import { exportTransactionsToCSV, downloadCSV } from "@/lib/csv/export";
import { useToast } from "@/components/toast-provider";
import type { Transaction } from "@/lib/api/transactions-client";
import type { Category } from "@/lib/api/categories-client";
import { usePlanLimits } from "@/hooks/use-plan-limits";
import { UpgradePrompt } from "@/components/billing/upgrade-prompt";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { DateRangePicker, type DateRange } from "@/components/ui/date-range-picker";
import { useConfirmDialog } from "@/hooks/use-confirm-dialog";
import { PageHeader } from "@/components/common/page-header";

interface Account {
  id: string;
  name: string;
  type: string;
}

export default function TransactionsPage() {
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { openDialog: openDeleteDialog, ConfirmDialog: DeleteConfirmDialog } = useConfirmDialog();
  const { openDialog: openDeleteMultipleDialog, ConfirmDialog: DeleteMultipleConfirmDialog } = useConfirmDialog();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [transactionForCategory, setTransactionForCategory] = useState<Transaction | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<"all-dates" | "today" | "past-7-days" | "past-15-days" | "past-30-days" | "past-90-days" | "last-3-months" | "last-month" | "last-6-months" | "past-6-months" | "this-month" | "this-year" | "year-to-date" | "last-year" | "custom">("all-dates");
  const [customDateRange, setCustomDateRange] = useState<DateRange | undefined>(undefined);
  const [filters, setFilters] = useState({
    startDate: "",
    endDate: "",
    accountId: "all",
    categoryId: "all",
    type: "all",
    search: "",
    recurring: "all",
  });
  const [activeCategoryIds, setActiveCategoryIds] = useState<Set<string>>(new Set());
  const [selectValue, setSelectValue] = useState<string>("");
  const { limits, loading: limitsLoading } = usePlanLimits();

  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deletingMultiple, setDeletingMultiple] = useState(false);
  const [processingSuggestionId, setProcessingSuggestionId] = useState<string | null>(null);
  const [suggestionsGenerated, setSuggestionsGenerated] = useState(false);
  const [selectedTransactionIds, setSelectedTransactionIds] = useState<Set<string>>(new Set());
  const selectAllCheckboxRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadData();
    // Set default date range to "All Dates" (no date filter)
    
    // Read categoryId from URL if present
    const categoryIdFromUrl = searchParams.get("categoryId");
    
    setFilters(prev => ({
      ...prev,
      startDate: "",
      endDate: "",
      categoryId: categoryIdFromUrl || "all",
    }));
    setDateRange("all-dates");
  }, [searchParams]);

  // Debounce search filter
  useEffect(() => {
    const timer = setTimeout(async () => {
      try {
        setLoading(true);
        const params = new URLSearchParams();
        if (filters.startDate) params.append("startDate", filters.startDate);
        if (filters.endDate) params.append("endDate", filters.endDate);
        if (filters.accountId && filters.accountId !== "all") params.append("accountId", filters.accountId);
        if (filters.categoryId && filters.categoryId !== "all") params.append("categoryId", filters.categoryId);
        if (filters.type && filters.type !== "all") params.append("type", filters.type);
        if (filters.search) params.append("search", filters.search);
        if (filters.recurring && filters.recurring !== "all") params.append("recurring", filters.recurring);

        const { getTransactionsClient } = await import("@/lib/api/transactions-client");
        const transactionFilters: any = {};
        if (filters.startDate) transactionFilters.startDate = new Date(filters.startDate);
        if (filters.endDate) transactionFilters.endDate = new Date(filters.endDate);
        if (filters.accountId && filters.accountId !== "all") transactionFilters.accountId = filters.accountId;
        if (filters.categoryId && filters.categoryId !== "all") transactionFilters.categoryId = filters.categoryId;
        if (filters.type && filters.type !== "all") transactionFilters.type = filters.type;
        if (filters.search) transactionFilters.search = filters.search;
        if (filters.recurring && filters.recurring !== "all") transactionFilters.recurring = filters.recurring === "true";
        const data = await getTransactionsClient(transactionFilters);
        setTransactions(data);
      } catch (error) {
        console.error("Error loading transactions:", error);
      } finally {
        setLoading(false);
      }
    }, filters.search ? 300 : 0); // Only debounce if search is active

    return () => clearTimeout(timer);
  }, [filters]);

  function getDateRangeDates(range: string): { startDate: string; endDate: string } | null {
    const today = new Date();
    const now = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    
    let startDate: Date;
    let endDate: Date;

    switch (range) {
      case "all-dates":
        return null; // No date filter
      case "today":
        startDate = new Date(now);
        endDate = new Date(now);
        break;
      case "past-7-days":
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 6);
        endDate = new Date(now);
        break;
      case "past-15-days":
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 14);
        endDate = new Date(now);
        break;
      case "past-30-days":
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 29);
        endDate = new Date(now);
        break;
      case "past-90-days":
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 89);
        endDate = new Date(now);
        break;
      case "last-3-months":
        startDate = new Date(today.getFullYear(), today.getMonth() - 3, 1);
        endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        break;
      case "last-month":
        startDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        endDate = new Date(today.getFullYear(), today.getMonth(), 0);
        break;
      case "last-6-months":
        startDate = new Date(today.getFullYear(), today.getMonth() - 6, 1);
        endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        break;
      case "past-6-months":
        startDate = new Date(now);
        startDate.setMonth(now.getMonth() - 6);
        endDate = new Date(now);
        break;
      case "this-month":
        startDate = new Date(today.getFullYear(), today.getMonth(), 1);
        endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        break;
      case "this-year":
        startDate = new Date(today.getFullYear(), 0, 1);
        endDate = new Date(today.getFullYear(), 11, 31);
        break;
      case "year-to-date":
        startDate = new Date(today.getFullYear(), 0, 1);
        endDate = new Date(now);
        break;
      case "last-year":
        startDate = new Date(today.getFullYear() - 1, 0, 1);
        endDate = new Date(today.getFullYear() - 1, 11, 31);
        break;
      default:
        startDate = new Date(today.getFullYear(), today.getMonth(), 1);
        endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        break;
    }

    return {
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
    };
  }

  function handleDateRangeChange(
    preset: "all-dates" | "today" | "past-7-days" | "past-15-days" | "past-30-days" | "past-90-days" | "last-3-months" | "last-month" | "last-6-months" | "past-6-months" | "this-month" | "this-year" | "year-to-date" | "last-year" | "custom",
    customRange?: DateRange
  ) {
    if (preset === "custom" && customRange) {
      setDateRange("custom");
      setCustomDateRange(customRange);
      setFilters(prev => ({
        ...prev,
        startDate: customRange.startDate,
        endDate: customRange.endDate,
      }));
    } else if (preset === "all-dates") {
      setDateRange("all-dates");
      setCustomDateRange(undefined);
      setFilters(prev => ({
        ...prev,
        startDate: "",
        endDate: "",
      }));
    } else {
      setDateRange(preset);
      setCustomDateRange(undefined);
      const dates = getDateRangeDates(preset);
      if (dates) {
        setFilters(prev => ({
          ...prev,
          startDate: dates.startDate,
          endDate: dates.endDate,
        }));
      } else {
        setFilters(prev => ({
          ...prev,
          startDate: "",
          endDate: "",
        }));
      }
    }
  }

  async function loadData() {
    try {
      const [
        { getAccountsClient },
        { getAllCategoriesClient },
      ] = await Promise.all([
        import("@/lib/api/accounts-client"),
        import("@/lib/api/categories-client"),
      ]);
      const [accountsData, categoriesData] = await Promise.all([
        getAccountsClient(),
        getAllCategoriesClient(),
      ]);
      setAccounts(accountsData);
      setCategories(categoriesData);
      
      // Initialize active categories with default ones
      const defaultCategoryNames = [
        "Restaurants",
        "Coffee",
        "Groceries",
        "Gifts",
        "Donation",
        "Donations",
        "Vehicle",
      ];
      const defaultCategories = categoriesData
        .filter((cat: Category) => defaultCategoryNames.includes(cat.name))
        .map((cat: Category) => cat.id);
      
      // Add category from URL if present
      const categoryIdFromUrl = searchParams.get("categoryId");
      const activeCategories = new Set<string>(defaultCategories);
      if (categoryIdFromUrl) {
        activeCategories.add(categoryIdFromUrl);
      }
      
      setActiveCategoryIds(activeCategories);
    } catch (error) {
      console.error("Error loading data:", error);
    }
  }

  async function loadTransactions() {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filters.startDate) params.append("startDate", filters.startDate);
      if (filters.endDate) params.append("endDate", filters.endDate);
      if (filters.accountId && filters.accountId !== "all") params.append("accountId", filters.accountId);
      if (filters.categoryId && filters.categoryId !== "all") params.append("categoryId", filters.categoryId);
      if (filters.type && filters.type !== "all") params.append("type", filters.type);
      if (filters.search) params.append("search", filters.search);
      if (filters.recurring && filters.recurring !== "all") params.append("recurring", filters.recurring);

      const { getTransactionsClient } = await import("@/lib/api/transactions-client");
      const transactionFilters: any = {};
      if (filters.startDate) transactionFilters.startDate = new Date(filters.startDate);
      if (filters.endDate) transactionFilters.endDate = new Date(filters.endDate);
      if (filters.accountId && filters.accountId !== "all") transactionFilters.accountId = filters.accountId;
      if (filters.categoryId && filters.categoryId !== "all") transactionFilters.categoryId = filters.categoryId;
      if (filters.type && filters.type !== "all") transactionFilters.type = filters.type;
      if (filters.search) transactionFilters.search = filters.search;
      if (filters.recurring && filters.recurring !== "all") transactionFilters.recurring = filters.recurring === "true";
      const data = await getTransactionsClient(transactionFilters);
      setTransactions(data);

      // Generate suggestions for existing transactions without category (only once per page load)
      if (!suggestionsGenerated) {
        const hasUncategorizedTransactions = data.some(tx => !tx.categoryId && !tx.suggestedCategoryId);
        if (hasUncategorizedTransactions) {
          setSuggestionsGenerated(true);
          // Generate suggestions in the background (don't wait for it)
          fetch("/api/transactions/generate-suggestions", { method: "POST" })
            .then(response => response.json())
            .then(result => {
              if (result.processed > 0) {
                console.log(`Generated ${result.processed} category suggestions for existing transactions`);
                // Reload transactions to show the new suggestions
                setTimeout(() => {
                  loadTransactions();
                }, 500); // Small delay to ensure database is updated
              }
            })
            .catch(error => {
              console.error("Error generating suggestions:", error);
            });
        }
      }
    } catch (error) {
      console.error("Error loading transactions:", error);
    } finally {
      setLoading(false);
    }
  }

  function handleDelete(id: string) {
    openDeleteDialog(
      {
        title: "Delete Transaction",
        description: "Are you sure you want to delete this transaction?",
        variant: "destructive",
        confirmLabel: "Delete",
      },
      async () => {
        const transactionToDelete = transactions.find(t => t.id === id);
        
        // Optimistic update: remove from UI immediately
        setTransactions(prev => prev.filter(t => t.id !== id));
        setDeletingId(id);

        try {
          const { deleteTransactionClient } = await import("@/lib/api/transactions-client");
          await deleteTransactionClient(id);

          toast({
            title: "Transaction deleted",
            description: "Your transaction has been deleted successfully.",
            variant: "success",
          });
          
          // Refresh router to update dashboard and other pages that depend on transactions
          router.refresh();
          
          // Não precisa recarregar - a atualização otimista já removeu da lista
          // O useEffect que monitora os filters vai manter a lista atualizada
        } catch (error) {
          console.error("Error deleting transaction:", error);
          // Revert optimistic update on error
          if (transactionToDelete) {
            setTransactions(prev => [...prev, transactionToDelete].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
          }
          toast({
            title: "Error",
            description: error instanceof Error ? error.message : "Failed to delete transaction",
            variant: "destructive",
          });
        } finally {
          setDeletingId(null);
        }
      }
    );
  }

  function handleDeleteMultiple() {
    const idsToDelete = Array.from(selectedTransactionIds);
    if (idsToDelete.length === 0) return;

    const count = idsToDelete.length;
    openDeleteMultipleDialog(
      {
        title: "Delete Transactions",
        description: `Are you sure you want to delete ${count} transaction${count > 1 ? 's' : ''}?`,
        variant: "destructive",
        confirmLabel: "Delete",
      },
      async () => {
        const transactionsToDelete = transactions.filter(t => idsToDelete.includes(t.id));
        
        // Optimistic update: remove from UI immediately
        setTransactions(prev => prev.filter(t => !idsToDelete.includes(t.id)));
        setDeletingMultiple(true);
        setSelectedTransactionIds(new Set());

        try {
          const { deleteMultipleTransactionsClient } = await import("@/lib/api/transactions-client");
          await deleteMultipleTransactionsClient(idsToDelete);

          toast({
            title: "Transactions deleted",
            description: `${count} transaction${count > 1 ? 's' : ''} deleted successfully.`,
            variant: "success",
          });
          
          // Refresh router to update dashboard and other pages that depend on transactions
          router.refresh();
        } catch (error) {
          console.error("Error deleting transactions:", error);
          // Revert optimistic update on error
          setTransactions(prev => {
            const restored = [...prev, ...transactionsToDelete];
            return restored.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
          });
          toast({
            title: "Error",
            description: error instanceof Error ? error.message : "Failed to delete transactions",
            variant: "destructive",
          });
        } finally {
          setDeletingMultiple(false);
        }
      }
    );
  }

  async function handleCategoryUpdate(categoryId: string | null, subcategoryId: string | null = null) {
    if (!transactionForCategory) return;

    try {
      const { updateTransactionClient } = await import("@/lib/api/transactions-client");
      
      // Optimistic update
      setTransactions(prev => prev.map(tx => 
        tx.id === transactionForCategory.id 
          ? { ...tx, categoryId: categoryId || undefined, subcategoryId: subcategoryId || undefined }
          : tx
      ));

      await updateTransactionClient(transactionForCategory.id, {
        categoryId: categoryId || undefined,
        subcategoryId: subcategoryId || undefined,
      });

      toast({
        title: "Category updated",
        description: "The transaction category has been updated successfully.",
        variant: "success",
      });

      setIsCategoryModalOpen(false);
      setTransactionForCategory(null);
      
      // Reload transactions to get updated category/subcategory names
      loadTransactions();
    } catch (error) {
      console.error("Error updating category:", error);
      
      // Revert optimistic update
      setTransactions(prev => prev.map(tx => 
        tx.id === transactionForCategory.id 
          ? transactionForCategory
          : tx
      ));

      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update category",
        variant: "destructive",
      });
    }
  }

  function handleExport() {
    // Check if user has access to CSV export
    if (!limits.hasCsvExport) {
      toast({
        title: "CSV Export Not Available",
        description: "CSV export is not available in your current plan. Upgrade to Basic or Premium to export your transactions.",
        variant: "destructive",
      });
      return;
    }

    const csv = exportTransactionsToCSV(transactions);
    downloadCSV(csv, `transactions-${format(new Date(), "yyyy-MM-dd")}.csv`);
  }

  function addCategoryToFilters(categoryId: string) {
    setActiveCategoryIds(prev => new Set([...prev, categoryId]));
  }

  function removeCategoryFromFilters(categoryId: string) {
    setActiveCategoryIds(prev => {
      const newSet = new Set(prev);
      newSet.delete(categoryId);
      return newSet;
    });
    // If the removed category was selected, reset to "all"
    if (filters.categoryId === categoryId) {
      setFilters(prev => ({ ...prev, categoryId: "all" }));
    }
  }

  async function handleApplySuggestion(transactionId: string) {
    const transaction = transactions.find(tx => tx.id === transactionId);
    if (!transaction) return;

    setProcessingSuggestionId(transactionId);
    
    // Optimistic update immediately
    setTransactions(prev => prev.map(tx => 
      tx.id === transactionId 
        ? { 
            ...tx, 
            categoryId: tx.suggestedCategoryId || tx.categoryId,
            subcategoryId: tx.suggestedSubcategoryId || tx.subcategoryId,
            suggestedCategoryId: null,
            suggestedSubcategoryId: null,
            suggestedCategory: null,
            suggestedSubcategory: null,
            // Use suggested category as category until we fetch the real one
            category: tx.suggestedCategory || tx.category,
            subcategory: tx.suggestedSubcategory || tx.subcategory,
          }
        : tx
    ));

    try {
      const response = await fetch(`/api/transactions/${transactionId}/apply-suggestion`, {
        method: "POST",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to apply suggestion");
      }

      // No need to fetch again - we already have the category data from suggestedCategory
      // The optimistic update already shows the correct category, so we're done

      toast({
        title: "Category applied",
        description: "The suggested category has been applied successfully.",
        variant: "success",
      });
    } catch (error) {
      console.error("Error applying suggestion:", error);
      
      // Revert optimistic update on error
      setTransactions(prev => prev.map(tx => 
        tx.id === transactionId ? transaction : tx
      ));

      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to apply suggestion",
        variant: "destructive",
      });
    } finally {
      setProcessingSuggestionId(null);
    }
  }

  function handleSelectAll(checked: boolean) {
    if (checked) {
      setSelectedTransactionIds(new Set(transactions.map(tx => tx.id)));
    } else {
      setSelectedTransactionIds(new Set());
    }
  }

  function handleSelectTransaction(transactionId: string, checked: boolean) {
    setSelectedTransactionIds(prev => {
      const newSet = new Set(prev);
      if (checked) {
        newSet.add(transactionId);
      } else {
        newSet.delete(transactionId);
      }
      return newSet;
    });
  }

  const allSelected = transactions.length > 0 && selectedTransactionIds.size === transactions.length;
  const someSelected = selectedTransactionIds.size > 0 && selectedTransactionIds.size < transactions.length;

  // Clear selection when transactions change (filters applied)
  useEffect(() => {
    // Only keep selected IDs that are still in the current transactions list
    setSelectedTransactionIds(prev => {
      const currentIds = new Set(transactions.map(tx => tx.id));
      const filtered = new Set([...prev].filter(id => currentIds.has(id)));
      return filtered;
    });
  }, [transactions]);

  // Update indeterminate state of select all checkbox
  useEffect(() => {
    if (selectAllCheckboxRef.current) {
      selectAllCheckboxRef.current.indeterminate = someSelected;
    }
  }, [someSelected]);

  async function handleRejectSuggestion(transactionId: string) {
    const transaction = transactions.find(tx => tx.id === transactionId);
    if (!transaction) return;

    setProcessingSuggestionId(transactionId);
    
    // Optimistic update immediately
    setTransactions(prev => prev.map(tx => 
      tx.id === transactionId 
        ? { 
            ...tx, 
            suggestedCategoryId: null,
            suggestedSubcategoryId: null,
            suggestedCategory: null,
            suggestedSubcategory: null,
          }
        : tx
    ));

    try {
      const response = await fetch(`/api/transactions/${transactionId}/reject-suggestion`, {
        method: "POST",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to reject suggestion");
      }

      toast({
        title: "Suggestion rejected",
        description: "You can now manually select a category.",
        variant: "success",
      });

      // Open category selection modal
      const updatedTransaction = transactions.find(tx => tx.id === transactionId);
      if (updatedTransaction) {
        setTransactionForCategory(updatedTransaction);
        setSelectedCategoryId(null);
        setSelectedSubcategoryId(null);
        setIsCategoryModalOpen(true);
      }
    } catch (error) {
      console.error("Error rejecting suggestion:", error);
      
      // Revert optimistic update on error
      setTransactions(prev => prev.map(tx => 
        tx.id === transactionId ? transaction : tx
      ));

      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to reject suggestion",
        variant: "destructive",
      });
    } finally {
      setProcessingSuggestionId(null);
    }
  }


  return (
    <div className="space-y-4 md:space-y-6">
      <PageHeader
        title="Transactions"
        description="Manage your income and expenses"
      >
        <div className="flex flex-wrap gap-2 justify-center md:justify-end">
          {selectedTransactionIds.size > 0 && (
            <Button 
              variant="destructive" 
              onClick={handleDeleteMultiple}
              disabled={deletingMultiple}
              className="text-xs md:text-sm"
            >
              {deletingMultiple ? (
                <>
                  <Loader2 className="h-3 w-3 md:h-4 md:w-4 md:mr-2 animate-spin" />
                  <span className="hidden md:inline">Deleting...</span>
                </>
              ) : (
                <>
                  <Trash2 className="h-3 w-3 md:h-4 md:w-4 md:mr-2" />
                  <span className="hidden md:inline">Delete ({selectedTransactionIds.size})</span>
                  <span className="md:hidden">Delete {selectedTransactionIds.size}</span>
                </>
              )}
            </Button>
          )}
          <Button variant="outline" onClick={() => setIsImportOpen(true)} className="text-xs md:text-sm">
            <Upload className="h-3 w-3 md:h-4 md:w-4 md:mr-2" />
            <span className="hidden md:inline">Import CSV</span>
          </Button>
          {transactions.length > 0 && (
          <Button variant="outline" onClick={handleExport} className="text-xs md:text-sm">
            <Download className="h-3 w-3 md:h-4 md:w-4 md:mr-2" />
            <span className="hidden md:inline">Export CSV</span>
          </Button>
          )}
          {transactions.length > 0 && (
            <Button onClick={() => {
              setSelectedTransaction(null);
              setIsFormOpen(true);
            }} className="text-xs md:text-sm">
              <Plus className="h-3 w-3 md:h-4 md:w-4 md:mr-2" />
              <span className="hidden md:inline">Add Transaction</span>
            </Button>
          )}
        </div>
      </PageHeader>

      {/* Filters - Only show when there are transactions or loading */}
      {(loading || transactions.length > 0) && (
        <>
      <div className="flex flex-wrap gap-2 items-center">
        <DateRangePicker
          value={dateRange}
          dateRange={customDateRange}
          onValueChange={handleDateRangeChange}
        />
        <Select
          value={filters.accountId}
          onValueChange={(value) => setFilters({ ...filters, accountId: value })}
        >
          <SelectTrigger className="h-9 w-auto min-w-[100px] text-xs">
            <SelectValue placeholder="Account" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            {accounts.map((account) => (
              <SelectItem key={account.id} value={account.id}>
                {account.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={filters.type}
          onValueChange={(value) => setFilters({ ...filters, type: value })}
        >
          <SelectTrigger className="h-9 w-auto min-w-[90px] text-xs">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
            <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="expense">Expense</SelectItem>
            <SelectItem value="income">Income</SelectItem>
          </SelectContent>
        </Select>
        <Input
          placeholder="Search..."
          value={filters.search}
          onChange={(e) => setFilters({ ...filters, search: e.target.value })}
          className="h-9 w-auto min-w-[120px] flex-1 max-w-[200px] text-xs"
        />
        {(filters.accountId !== "all" || filters.type !== "all" || filters.search || filters.recurring !== "all" || dateRange !== "all-dates" || customDateRange) && (
          <Button 
            variant="ghost" 
            onClick={() => {
              setDateRange("all-dates");
              setCustomDateRange(undefined);
              setFilters({
                startDate: "",
                endDate: "",
                accountId: "all",
                categoryId: "all",
                type: "all",
                search: "",
                recurring: "all",
              });
            }} 
            className="h-9 text-xs text-muted-foreground hover:text-foreground"
          >
            Clear
          </Button>
        )}
      </div>

      {/* Category Pills Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <Button
          variant={filters.categoryId === "all" ? "default" : "outline"}
          onClick={() => setFilters({ ...filters, categoryId: "all" })}
          className="rounded-full"
        >
          All
        </Button>
        {categories
          .filter((category) => activeCategoryIds.has(category.id))
          .map((category) => (
            <Button
              key={category.id}
              variant={filters.categoryId === category.id ? "default" : "outline"}
              onClick={() => setFilters({ ...filters, categoryId: category.id })}
              className="rounded-full"
            >
              {category.name}
            </Button>
          ))}
        <Select
          value={selectValue}
          onValueChange={(value) => {
            if (value) {
              if (activeCategoryIds.has(value)) {
                removeCategoryFromFilters(value);
              } else {
                addCategoryToFilters(value);
              }
              setSelectValue(""); // Reset after adding/removing
            }
          }}
        >
          <SelectTrigger className="h-9 w-9 rounded-full border-dashed p-0 [&>svg:last-child]:hidden flex items-center justify-center">
            <Plus className="h-4 w-4" />
            <SelectValue className="hidden" />
          </SelectTrigger>
          <SelectContent>
            {categories.map((category) => {
              const isActive = activeCategoryIds.has(category.id);
              return (
                <SelectItem key={category.id} value={category.id}>
                  <div className="flex items-center gap-2 w-full">
                    <span className="flex-1">{category.name}</span>
                    {isActive && (
                      <Check className="h-4 w-4 text-primary" />
                    )}
                  </div>
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </div>
        </>
      )}

      {/* Mobile Card View */}
      {!loading && transactions.length > 0 && (
        <div className="lg:hidden space-y-3">
          {transactions.map((tx) => {
            const plaidMeta = tx.plaidMetadata as any;
            return (
              <TransactionsMobileCard
                key={tx.id}
                transaction={tx}
                isSelected={selectedTransactionIds.has(tx.id)}
                onSelect={(checked) => handleSelectTransaction(tx.id, checked)}
                onEdit={() => {
                  setSelectedTransaction(tx);
                  setIsFormOpen(true);
                }}
                onDelete={() => handleDelete(tx.id)}
                deleting={deletingId === tx.id}
                onCategoryClick={() => {
                  setTransactionForCategory(tx);
                  setSelectedCategoryId(tx.categoryId || null);
                  setSelectedSubcategoryId(tx.subcategoryId || null);
                  setIsCategoryModalOpen(true);
                }}
                onApplySuggestion={tx.suggestedCategoryId ? () => handleApplySuggestion(tx.id) : undefined}
                onRejectSuggestion={tx.suggestedCategoryId ? () => handleRejectSuggestion(tx.id) : undefined}
                processingSuggestion={processingSuggestionId === tx.id}
              />
            );
          })}
        </div>
      )}

      {/* Empty State - Show when no transactions and not loading */}
      {!loading && transactions.length === 0 && (
          <EmptyState
            icon={Receipt}
            title="No transactions yet"
            description="Start tracking your finances by adding your first transaction or importing from a CSV file."
            actionLabel="Add Transaction"
            onAction={() => {
              setSelectedTransaction(null);
              setIsFormOpen(true);
            }}
            actionIcon={Plus}
          />
      )}

      {/* Desktop/Tablet Table View - Only show when there are transactions or loading */}
      {(loading || transactions.length > 0) && (
      <div className="hidden lg:block rounded-[12px] border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40px]">
                <Checkbox
                  ref={selectAllCheckboxRef}
                  checked={allSelected}
                  onCheckedChange={handleSelectAll}
                  className="h-4 w-4"
                />
              </TableHead>
              <TableHead className="text-xs md:text-sm">Date</TableHead>
              <TableHead className="text-xs md:text-sm">Type</TableHead>
              <TableHead className="text-xs md:text-sm hidden md:table-cell">Account</TableHead>
              <TableHead className="text-xs md:text-sm hidden sm:table-cell">Category</TableHead>
              <TableHead className="text-xs md:text-sm hidden lg:table-cell">Description</TableHead>
              <TableHead className="text-xs md:text-sm hidden xl:table-cell">Status</TableHead>
              <TableHead className="text-right text-xs md:text-sm">Amount</TableHead>
              <TableHead className="text-xs md:text-sm">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                  Loading transactions...
                </TableCell>
              </TableRow>
            ) : (
              transactions.map((tx) => {
                // Debug: log all transactions without category to see if they have suggestions
                if (!tx.categoryId) {
                  console.log('[TransactionsPage] Transaction without category:', {
                    id: tx.id,
                    description: tx.description,
                    amount: tx.amount,
                    type: tx.type,
                    categoryId: tx.categoryId,
                    suggestedCategoryId: tx.suggestedCategoryId,
                    suggestedSubcategoryId: tx.suggestedSubcategoryId,
                    suggestedCategory: tx.suggestedCategory,
                    suggestedSubcategory: tx.suggestedSubcategory,
                    hasSuggestedCategoryId: !!tx.suggestedCategoryId,
                    hasSuggestedCategory: !!tx.suggestedCategory,
                    willShowSuggestion: !!tx.suggestedCategoryId,
                  });
                }
                const plaidMeta = tx.plaidMetadata as any;
                const isPending = plaidMeta?.pending;
                const authorizedDate = plaidMeta?.authorized_date || plaidMeta?.authorized_datetime;
                const currencyCode = plaidMeta?.iso_currency_code || plaidMeta?.unofficial_currency_code;
                
                return (
              <TableRow key={tx.id}>
                <TableCell>
                  <Checkbox
                    checked={selectedTransactionIds.has(tx.id)}
                    onCheckedChange={(checked) => handleSelectTransaction(tx.id, checked as boolean)}
                    className="h-4 w-4"
                  />
                </TableCell>
                <TableCell className="font-medium text-xs md:text-sm whitespace-nowrap">
                  <div className="flex flex-col gap-0.5">
                    <span>{format(new Date(tx.date), "MMM dd, yyyy")}</span>
                    {authorizedDate && (
                      <span className="text-[10px] text-muted-foreground">
                        Auth: {format(new Date(authorizedDate), "MMM dd")}
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <span className={`rounded-[12px] px-1.5 md:px-2 py-0.5 md:py-1 text-[10px] md:text-xs ${
                      tx.type === "income" ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" :
                      tx.type === "expense" ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200" :
                      "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                    }`}>
                      {tx.type}
                    </span>
                    {tx.recurring && (
                      <span title="Recurring transaction">
                        <Repeat className="h-3 w-3 text-muted-foreground" />
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-xs md:text-sm hidden md:table-cell">{tx.account?.name}</TableCell>
                <TableCell 
                  className="text-xs md:text-sm hidden sm:table-cell"
                >
                  {tx.category?.name ? (
                    <span 
                      className="text-blue-600 dark:text-blue-400 underline decoration-dashed underline-offset-2 cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => {
                        setTransactionForCategory(tx);
                        setSelectedCategoryId(tx.categoryId || null);
                        setSelectedSubcategoryId(tx.subcategoryId || null);
                        setIsCategoryModalOpen(true);
                      }}
                    >
                      {tx.category.name}
                      {tx.subcategory && ` / ${tx.subcategory.name}`}
                    </span>
                  ) : tx.suggestedCategoryId ? (
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground italic">
                        {tx.suggestedCategory?.name || "Suggested category"}
                        {tx.suggestedSubcategory && ` / ${tx.suggestedSubcategory.name}`}
                      </span>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-6 w-6 rounded-[8px] bg-white border border-gray-300 text-red-600 hover:text-red-700 hover:bg-red-50 dark:bg-white dark:border-gray-300 dark:hover:bg-red-50"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRejectSuggestion(tx.id);
                          }}
                          disabled={processingSuggestionId === tx.id}
                          title="Reject suggestion and select manually"
                        >
                          {processingSuggestionId === tx.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <X className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-6 w-6 rounded-[8px] bg-white border border-gray-300 text-green-600 hover:text-green-700 hover:bg-green-50 dark:bg-white dark:border-gray-300 dark:hover:bg-green-50"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleApplySuggestion(tx.id);
                          }}
                          disabled={processingSuggestionId === tx.id}
                          title="Apply suggestion"
                        >
                          {processingSuggestionId === tx.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Check className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <span 
                      className="text-blue-600 dark:text-blue-400 underline decoration-dashed underline-offset-2 cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => {
                        setTransactionForCategory(tx);
                        setSelectedCategoryId(tx.categoryId || null);
                        setSelectedSubcategoryId(tx.subcategoryId || null);
                        setIsCategoryModalOpen(true);
                      }}
                    >
                      Add Category
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-xs md:text-sm hidden lg:table-cell max-w-[150px] truncate">{tx.description || "-"}</TableCell>
                <TableCell className="text-xs md:text-sm hidden xl:table-cell">
                  <div className="flex flex-col gap-1">
                    {isPending && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400">
                        <Clock className="h-2.5 w-2.5 mr-1" />
                        Pending
                      </Badge>
                    )}
                    {currencyCode && currencyCode !== "USD" && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0.5">
                        {currencyCode}
                      </Badge>
                    )}
                    {!isPending && (!currencyCode || currencyCode === "USD") && (
                      <span className="text-muted-foreground text-xs">-</span>
                    )}
                  </div>
                </TableCell>
                <TableCell className={`text-right font-medium text-xs md:text-sm ${
                  tx.type === "income" ? "text-green-600 dark:text-green-400" :
                  tx.type === "expense" ? "text-red-600 dark:text-red-400" : ""
                }`}>
                  <div className="flex flex-col items-end gap-0.5">
                    <span>{tx.type === "expense" ? "-" : ""}{formatMoney(tx.amount)}</span>
                    {currencyCode && currencyCode !== "USD" && (
                      <span className="text-[10px] text-muted-foreground">
                        {currencyCode}
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex space-x-1 md:space-x-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 md:h-10 md:w-10"
                      onClick={() => {
                        setSelectedTransaction(tx);
                        setIsFormOpen(true);
                      }}
                    >
                      <Edit className="h-3 w-3 md:h-4 md:w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 md:h-10 md:w-10"
                      onClick={() => handleDelete(tx.id)}
                      disabled={deletingId === tx.id}
                    >
                      {deletingId === tx.id ? (
                        <Loader2 className="h-3 w-3 md:h-4 md:w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-3 w-3 md:h-4 md:w-4" />
                      )}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
              );
              })
            )}
          </TableBody>
        </Table>
      </div>
      )}

      <TransactionForm
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        transaction={selectedTransaction}
        onSuccess={loadTransactions}
      />

      <CsvImportDialog
        open={isImportOpen}
        onOpenChange={setIsImportOpen}
        onSuccess={loadTransactions}
        accounts={accounts}
        categories={categories}
      />

      {/* Category Selection Modal */}
      <Dialog open={isCategoryModalOpen} onOpenChange={setIsCategoryModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {transactionForCategory?.category?.name ? "Change Category" : "Add Category"}
            </DialogTitle>
            <DialogDescription>
              Select a category for this transaction
            </DialogDescription>
          </DialogHeader>
          <CategorySelectionModal
            transaction={transactionForCategory}
            categories={categories}
            onSelect={(categoryId, subcategoryId) => {
              setSelectedCategoryId(categoryId);
              setSelectedSubcategoryId(subcategoryId);
            }}
            onClear={() => {
              setSelectedCategoryId(null);
              setSelectedSubcategoryId(null);
              handleCategoryUpdate(null, null);
            }}
          />
          <DialogFooter>
            {transactionForCategory?.categoryId && (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setSelectedCategoryId(null);
                  setSelectedSubcategoryId(null);
                  handleCategoryUpdate(null, null);
                }}
              >
                Clear
              </Button>
            )}
            <Button
              type="button"
              onClick={() => {
                handleCategoryUpdate(selectedCategoryId, selectedSubcategoryId);
              }}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {DeleteConfirmDialog}
      {DeleteMultipleConfirmDialog}
    </div>
  );
}

