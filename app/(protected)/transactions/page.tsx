"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
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
import { formatMoney } from "@/components/common/money";
import { EmptyState } from "@/components/common/empty-state";
import { Plus, Download, Upload, Search, Trash2, Edit, Repeat, Check, Receipt } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

interface Account {
  id: string;
  name: string;
  type: string;
}

export default function TransactionsPage() {
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [dateRange, setDateRange] = useState("this-month");
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

  useEffect(() => {
    loadData();
    // Set default date range (this month)
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    
    // Read categoryId from URL if present
    const categoryIdFromUrl = searchParams.get("categoryId");
    
    setFilters(prev => ({
      ...prev,
      startDate: startOfMonth.toISOString().split('T')[0],
      endDate: endOfMonth.toISOString().split('T')[0],
      categoryId: categoryIdFromUrl || "all",
    }));
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

  function getDateRangeDates(range: string): { startDate: string; endDate: string } {
    const today = new Date();
    const now = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    
    let startDate: Date;
    let endDate: Date;

    switch (range) {
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
      case "last-month":
        startDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        endDate = new Date(today.getFullYear(), today.getMonth(), 0);
        break;
      case "this-month":
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

  function handleDateRangeChange(range: string) {
    setDateRange(range);
    const dates = getDateRangeDates(range);
    setFilters(prev => ({
      ...prev,
      startDate: dates.startDate,
      endDate: dates.endDate,
    }));
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
    } catch (error) {
      console.error("Error loading transactions:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to delete this transaction?")) return;

    const transactionToDelete = transactions.find(t => t.id === id);
    
    // Optimistic update: remove from UI immediately
    setTransactions(prev => prev.filter(t => t.id !== id));

    try {
      const { deleteTransactionClient } = await import("@/lib/api/transactions-client");
      await deleteTransactionClient(id);

      toast({
        title: "Transaction deleted",
        description: "Your transaction has been deleted successfully.",
        variant: "success",
      });
      
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

  // Show empty state when no transactions and not loading
  if (!loading && transactions.length === 0) {
    return (
      <div>
        <EmptyState
          image={<Receipt className="w-full h-full text-muted-foreground opacity-50" />}
          title="No transactions found"
          description="Start tracking your income and expenses by adding your first transaction."
          action={{
            label: "Add Transaction",
            onClick: () => {
              setSelectedTransaction(null);
              setIsFormOpen(true);
            },
          }}
        />
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
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Transactions</h1>
          <p className="text-sm md:text-base text-muted-foreground">Manage your income and expenses</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => setIsImportOpen(true)} className="text-xs md:text-sm">
            <Upload className="mr-1 md:mr-2 h-3 w-3 md:h-4 md:w-4" />
            <span className="hidden sm:inline">Import CSV</span>
            <span className="sm:hidden">Import</span>
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport} className="text-xs md:text-sm">
            <Download className="mr-1 md:mr-2 h-3 w-3 md:h-4 md:w-4" />
            <span className="hidden sm:inline">Export CSV</span>
            <span className="sm:hidden">Export</span>
          </Button>
          <Button size="sm" onClick={() => {
            setSelectedTransaction(null);
            setIsFormOpen(true);
          }} className="text-xs md:text-sm">
            <Plus className="mr-1 md:mr-2 h-3 w-3 md:h-4 md:w-4" />
            Add Transaction
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <Select
          value={dateRange}
          onValueChange={handleDateRangeChange}
        >
          <SelectTrigger className="h-9 w-auto min-w-[120px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="this-month">This month</SelectItem>
            <SelectItem value="last-month">Last Month</SelectItem>
            <SelectItem value="past-30-days">Past 30 days</SelectItem>
            <SelectItem value="past-15-days">Past 15 days</SelectItem>
            <SelectItem value="past-7-days">Past 7 days</SelectItem>
            <SelectItem value="today">Today</SelectItem>
          </SelectContent>
        </Select>
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
            <SelectItem value="transfer">Transfer</SelectItem>
          </SelectContent>
        </Select>
        <Input
          placeholder="Search..."
          value={filters.search}
          onChange={(e) => setFilters({ ...filters, search: e.target.value })}
          className="h-9 w-auto min-w-[120px] flex-1 max-w-[200px] text-xs"
        />
        {(filters.accountId !== "all" || filters.type !== "all" || filters.search || filters.recurring !== "all" || dateRange !== "this-month") && (
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => {
              setDateRange("this-month");
              const dates = getDateRangeDates("this-month");
              setFilters({
                startDate: dates.startDate,
                endDate: dates.endDate,
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
          size="sm"
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
              size="sm"
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

      {/* Transactions Table */}
      <div className="rounded-[12px] border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs md:text-sm">Date</TableHead>
              <TableHead className="text-xs md:text-sm">Type</TableHead>
              <TableHead className="text-xs md:text-sm hidden md:table-cell">Account</TableHead>
              <TableHead className="text-xs md:text-sm hidden sm:table-cell">Category</TableHead>
              <TableHead className="text-xs md:text-sm hidden lg:table-cell">Description</TableHead>
              <TableHead className="text-right text-xs md:text-sm">Amount</TableHead>
              <TableHead className="text-xs md:text-sm">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  Loading transactions...
                </TableCell>
              </TableRow>
            ) : (
              transactions.map((tx) => (
              <TableRow key={tx.id}>
                <TableCell className="text-xs md:text-sm whitespace-nowrap">{format(new Date(tx.date), "MMM dd, yyyy")}</TableCell>
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
                <TableCell className="text-xs md:text-sm hidden sm:table-cell">
                  {tx.category?.name}
                  {tx.subcategory && ` / ${tx.subcategory.name}`}
                </TableCell>
                <TableCell className="text-xs md:text-sm hidden lg:table-cell max-w-[150px] truncate">{tx.description || "-"}</TableCell>
                <TableCell className={`text-right font-medium text-xs md:text-sm ${
                  tx.type === "income" ? "text-green-600 dark:text-green-400" :
                  tx.type === "expense" ? "text-red-600 dark:text-red-400" : ""
                }`}>
                  {tx.type === "expense" ? "-" : ""}{formatMoney(tx.amount)}
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
                    >
                      <Trash2 className="h-3 w-3 md:h-4 md:w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

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
    </div>
  );
}

