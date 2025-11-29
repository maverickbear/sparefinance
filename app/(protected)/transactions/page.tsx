"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { logger } from "@/src/infrastructure/utils/logger";
import { usePagePerformance } from "@/hooks/use-page-performance";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import dynamic from "next/dynamic";

// Lazy load heavy form components
const TransactionForm = dynamic(() => import("@/components/forms/transaction-form").then(m => ({ default: m.TransactionForm })), { ssr: false });
const CsvImportDialog = dynamic(() => import("@/components/forms/csv-import-dialog").then(m => ({ default: m.CsvImportDialog })), { ssr: false });
const CategorySelectionDialog = dynamic(() => import("@/components/transactions/category-selection-dialog").then(m => ({ default: m.CategorySelectionDialog })), { ssr: false });
const BlockedFeature = dynamic(() => import("@/components/common/blocked-feature").then(m => ({ default: m.BlockedFeature })), { ssr: false });
import { formatMoney } from "@/components/common/money";
import { Plus, Download, Upload, Search, Trash2, Edit, Repeat, Check, Loader2, X, ChevronLeft, ChevronRight, Filter, Calendar, Wallet, Tag, Type, XCircle, Receipt, RefreshCw } from "lucide-react";
import { TransactionsMobileCard } from "@/components/transactions/transactions-mobile-card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  SimpleTabs,
  SimpleTabsList,
  SimpleTabsTrigger,
} from "@/components/ui/simple-tabs";
import { FixedTabsWrapper } from "@/components/common/fixed-tabs-wrapper";
import { Input } from "@/components/ui/input";
import { formatTransactionDate, formatShortDate, parseDateWithoutTimezone, parseDateInput, formatDateInput } from "@/src/infrastructure/utils/timestamp";
import { format } from "date-fns";
import { exportTransactionsToCSV, downloadCSV } from "@/lib/csv/export";
import { useToast } from "@/components/toast-provider";
import type { Transaction } from "@/src/domain/transactions/transactions.types";
import type { Category } from "@/src/domain/categories/categories.types";
import { useSubscription } from "@/hooks/use-subscription";
import { Badge } from "@/components/ui/badge";
import { useWriteGuard } from "@/hooks/use-write-guard";
import { Checkbox } from "@/components/ui/checkbox";
import { DateRangePicker, type DateRange } from "@/components/ui/date-range-picker";
import { useConfirmDialog } from "@/hooks/use-confirm-dialog";
import { PageHeader } from "@/components/common/page-header";
import { ImportStatusBanner } from "@/components/accounts/import-status-banner";

interface Account {
  id: string;
  name: string;
  type: string;
}

// Component for category menu item that may have subcategories
function CategoryMenuItem({
  category,
  onSelect,
  loadSubcategories,
}: {
  category: Category;
  onSelect: (categoryId: string, subcategoryId: string | null) => void;
  loadSubcategories: (categoryId: string) => Promise<Array<{ id: string; name: string }>>;
}) {
  const [subcategories, setSubcategories] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [hasChecked, setHasChecked] = useState(false);

  const handleOpenChange = async (open: boolean) => {
    if (open && !hasChecked && !category.subcategories) {
      setLoading(true);
      setHasChecked(true);
      try {
        const subcats = await loadSubcategories(category.id);
        setSubcategories(subcats);
      } catch (error) {
        logger.error("Error loading subcategories:", error);
      } finally {
        setLoading(false);
      }
    } else if (category.subcategories) {
      setSubcategories(category.subcategories);
    }
  };

  const finalSubcategories = subcategories.length > 0 
    ? subcategories 
    : (category.subcategories || []);
  
  const hasSubcategories = finalSubcategories.length > 0;

  // Always show as submenu if we're loading or if we have subcategories
  // This ensures the menu structure is consistent
  if (hasSubcategories || loading || !hasChecked) {
    return (
      <DropdownMenuSub onOpenChange={handleOpenChange}>
        <DropdownMenuSubTrigger className="text-xs">
          {category.name}
        </DropdownMenuSubTrigger>
        <DropdownMenuSubContent>
          {loading ? (
            <DropdownMenuItem disabled className="text-xs">
              Loading...
            </DropdownMenuItem>
          ) : hasSubcategories ? (
            <>
              <DropdownMenuItem
                onClick={() => onSelect(category.id, null)}
                className="text-xs"
              >
                No Subcategory
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {finalSubcategories.map((subcategory) => (
                <DropdownMenuItem
                  key={subcategory.id}
                  onClick={() => onSelect(category.id, subcategory.id)}
                  className="text-xs"
                >
                  {subcategory.name}
                </DropdownMenuItem>
              ))}
            </>
          ) : (
            <DropdownMenuItem
              onClick={() => onSelect(category.id, null)}
              className="text-xs"
            >
              No Subcategory
            </DropdownMenuItem>
          )}
        </DropdownMenuSubContent>
      </DropdownMenuSub>
    );
  }

  // If we've checked and there are no subcategories, show as simple item
  return (
    <DropdownMenuItem
      onClick={() => onSelect(category.id, null)}
      className="text-xs"
    >
      {category.name}
    </DropdownMenuItem>
  );
}

export default function TransactionsPage() {
  const perf = usePagePerformance("Transactions");
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { openDialog: openDeleteDialog, ConfirmDialog: DeleteConfirmDialog } = useConfirmDialog();
  const { openDialog: openDeleteMultipleDialog, ConfirmDialog: DeleteMultipleConfirmDialog } = useConfirmDialog();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [totalTransactions, setTotalTransactions] = useState(0);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [showImportUpgradeModal, setShowImportUpgradeModal] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [isFiltersModalOpen, setIsFiltersModalOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [transactionForCategory, setTransactionForCategory] = useState<Transaction | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState<string | null>(null);
  const [clearCategoryTrigger, setClearCategoryTrigger] = useState(0);
  const [dateRange, setDateRange] = useState<"all-dates" | "today" | "past-7-days" | "past-15-days" | "past-30-days" | "past-90-days" | "last-3-months" | "last-month" | "last-6-months" | "past-6-months" | "this-month" | "this-year" | "year-to-date" | "last-year" | "custom">("all-dates");
  const [customDateRange, setCustomDateRange] = useState<DateRange | undefined>(undefined);
  const [filters, setFilters] = useState({
    startDate: "",
    endDate: "",
    accountId: "all",
    categoryId: "all",
    type: "expense", // Default to expense instead of "all"
    search: "",
    recurring: "all",
  });
  const [activeCategoryIds, setActiveCategoryIds] = useState<Set<string>>(new Set());
  const [selectValue, setSelectValue] = useState<string>("");
  const { limits, checking: limitsLoading } = useSubscription();
  const { checkWriteAccess, canWrite } = useWriteGuard();

  const [loading, setLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [syncingAll, setSyncingAll] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deletingMultiple, setDeletingMultiple] = useState(false);
  const [updatingTypes, setUpdatingTypes] = useState(false);
  const [updatingCategories, setUpdatingCategories] = useState(false);
  const [processingSuggestionId, setProcessingSuggestionId] = useState<string | null>(null);
  const [suggestionsGenerated, setSuggestionsGenerated] = useState(false);
  const [selectedTransactionIds, setSelectedTransactionIds] = useState<Set<string>>(new Set());
  const [editingDateId, setEditingDateId] = useState<string | null>(null);
  const [editingDescriptionId, setEditingDescriptionId] = useState<string | null>(null);
  const [editingDateValue, setEditingDateValue] = useState<string>("");
  const [editingDescriptionValue, setEditingDescriptionValue] = useState<string>("");
  const [updatingTransactionId, setUpdatingTransactionId] = useState<string | null>(null);
  const selectAllCheckboxRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const loadTransactionsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const dateInputRefs = useRef<Map<string, HTMLInputElement>>(new Map());
  const descriptionInputRefs = useRef<Map<string, HTMLInputElement>>(new Map());
  const pullToRefreshRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef<number>(0);
  const touchCurrentY = useRef<number>(0);
  const isPulling = useRef<boolean>(false);
  const currentPullDistance = useRef<number>(0);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]); // Accumulated transactions for mobile
  const [loadingMore, setLoadingMore] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // OPTIMIZED: Cache mobile detection to avoid repeated window.innerWidth checks
  const [isMobile, setIsMobile] = useState(false);
  
  // Update mobile detection on mount and window resize
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(typeof window !== 'undefined' && window.innerWidth < 1024);
    };
    
    // Check on mount
    checkMobile();
    
    // Listen for resize events (debounced)
    let resizeTimeout: NodeJS.Timeout;
    const handleResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(checkMobile, 150);
    };
    
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(resizeTimeout);
    };
  }, []);

  // Focus date input when editing starts
  useEffect(() => {
    if (editingDateId) {
      const input = dateInputRefs.current.get(editingDateId);
      if (input) {
        input.focus();
        input.select();
      }
    }
  }, [editingDateId]);

  // Focus description input when editing starts
  useEffect(() => {
    if (editingDescriptionId) {
      const input = descriptionInputRefs.current.get(editingDescriptionId);
      if (input) {
        input.focus();
        input.select();
      }
    }
  }, [editingDescriptionId]);

  // Load initial data - only run once on mount
  useEffect(() => {
    loadData();
  }, []);

  // Parse URL params when searchParams change
  useEffect(() => {
    // Read filters from URL if present
    const categoryIdFromUrl = searchParams.get("categoryId");
    const typeFromUrl = searchParams.get("type");
    const startDateFromUrl = searchParams.get("startDate");
    const endDateFromUrl = searchParams.get("endDate");
    
    // Determine date range preset if dates are provided
    let dateRangePreset: typeof dateRange = "all-dates";
    if (startDateFromUrl && endDateFromUrl) {
      // Check if it's a single month range
      const startDate = new Date(startDateFromUrl);
      const endDate = new Date(endDateFromUrl);
      const isStartOfMonth = startDate.getDate() === 1;
      const isEndOfMonth = endDate.getDate() === new Date(endDate.getFullYear(), endDate.getMonth() + 1, 0).getDate();
      const isSameMonth = startDate.getMonth() === endDate.getMonth() && startDate.getFullYear() === endDate.getFullYear();
      
      if (isStartOfMonth && isEndOfMonth && isSameMonth) {
        const now = new Date();
        const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const urlMonth = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
        
        if (urlMonth.getTime() === currentMonth.getTime()) {
          dateRangePreset = "this-month";
        } else {
          dateRangePreset = "custom";
        }
      } else {
        dateRangePreset = "custom";
      }
    }
    
    setFilters(prev => ({
      ...prev,
      startDate: startDateFromUrl || "",
      endDate: endDateFromUrl || "",
      categoryId: categoryIdFromUrl || "all",
      type: typeFromUrl || "all",
    }));
    setDateRange(dateRangePreset);
    
    // Set custom date range if dates are provided
    if (startDateFromUrl && endDateFromUrl) {
      setCustomDateRange({
        startDate: startDateFromUrl,
        endDate: endDateFromUrl,
      });
    }
  }, [searchParams]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
    setAllTransactions([]); // Clear accumulated transactions when filters change
  }, [filters]);

  // Calculate totalPages using useMemo to avoid reference errors
  const totalPages = useMemo(() => {
    return Math.ceil(totalTransactions / itemsPerPage);
  }, [totalTransactions, itemsPerPage]);

  // Reset loadingMore when transactions are loaded
  useEffect(() => {
    if (!loading) {
      setLoadingMore(false);
    }
  }, [loading]);

  // Handle Load More button click for mobile
  const handleLoadMore = () => {
    if (!isMobile) return;
    if (loading || loadingMore || currentPage >= totalPages) return;
    setLoadingMore(true);
    setCurrentPage(prev => prev + 1);
  };

  // Pull to refresh for mobile
  useEffect(() => {
    const container = pullToRefreshRef.current;
    if (!container) return;

    const handleTouchStart = (e: TouchEvent) => {
      if (window.scrollY === 0) {
        touchStartY.current = e.touches[0].clientY;
        isPulling.current = true;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isPulling.current) return;
      
      touchCurrentY.current = e.touches[0].clientY;
      const distance = touchCurrentY.current - touchStartY.current;
      
      if (distance > 0 && window.scrollY === 0) {
        e.preventDefault();
        const pullDistance = Math.min(distance, 100);
        currentPullDistance.current = pullDistance;
        setPullDistance(pullDistance);
      } else {
        isPulling.current = false;
        currentPullDistance.current = 0;
        setPullDistance(0);
      }
    };

    const handleTouchEnd = () => {
      if (currentPullDistance.current >= 60 && !loading && !isRefreshing) {
        setIsRefreshing(true);
        setCurrentPage(1);
        setAllTransactions([]);
        // Trigger reload
        setTimeout(() => {
          loadTransactions().finally(() => {
            setIsRefreshing(false);
            setPullDistance(0);
            currentPullDistance.current = 0;
          });
        }, 100);
      } else {
        setPullDistance(0);
        currentPullDistance.current = 0;
      }
      isPulling.current = false;
    };

    container.addEventListener('touchstart', handleTouchStart, { passive: true });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pullDistance, loading, isRefreshing]);

  // Debounced transaction loading - consolidates all transaction fetching
  // This handles both filter changes and pagination changes
  useEffect(() => {
    // Clear any pending timeout
    if (loadTransactionsTimeoutRef.current) {
      clearTimeout(loadTransactionsTimeoutRef.current);
    }

    // Cancel any in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Activate search loading if there's a search term
    const hasSearch = !!filters.search;
    if (hasSearch) {
      setSearchLoading(true);
    } else {
      // Clear search loading if search is cleared
      setSearchLoading(false);
    }

    // Debounce the request (longer delay for search to reduce rapid requests)
    // No debounce for page changes, only for filter changes
    const delay = filters.search ? 500 : (Object.keys(filters).some(key => key !== 'search' && filters[key as keyof typeof filters] !== 'all' && filters[key as keyof typeof filters] !== '') ? 200 : 0);
    loadTransactionsTimeoutRef.current = setTimeout(() => {
      loadTransactions();
    }, delay);

    return () => {
      if (loadTransactionsTimeoutRef.current) {
        clearTimeout(loadTransactionsTimeoutRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, currentPage, itemsPerPage]); // loadTransactions is stable, no need to include in deps

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
      // Load accounts and categories in parallel using API routes
      // OPTIMIZED: Skip investment balances calculation for Transactions page (not needed, saves ~1s)
      const [accountsResponse, categoriesResponse] = await Promise.all([
        fetch("/api/v2/accounts?includeHoldings=false"),
        fetch("/api/v2/categories?all=true"),
      ]);
      
      if (!accountsResponse.ok || !categoriesResponse.ok) {
        throw new Error("Failed to fetch data");
      }
      
      const [accountsData, categoriesData] = await Promise.all([
        accountsResponse.json(),
        categoriesResponse.json(),
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
      logger.error("Error loading data:", error);
    }
  }

  async function handleSyncAll() {
    try {
      setSyncingAll(true);
      const response = await fetch('/api/plaid/sync-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to sync transactions');
      }

      toast({
        title: 'Transactions synced',
        description: `Synced ${data.synced} new transactions from ${data.accounts} account${data.accounts !== 1 ? 's' : ''}. ${data.skipped} were skipped.`,
        variant: 'success',
      });

      // Reload transactions to show newly synced ones
      await loadTransactions(true);
      
      // Refresh router to update dashboard and other pages
      router.refresh();
    } catch (error: any) {
      console.error('Error syncing transactions:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to sync transactions',
        variant: 'destructive',
      });
    } finally {
      setSyncingAll(false);
    }
  }


  async function loadTransactions(forceRefresh: boolean = false) {
    // Cancel any previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new abort controller for this request
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

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

      // Add pagination parameters
      // For mobile infinite scroll, always use 10 items per page
      // OPTIMIZED: Use cached mobile detection state
      // IMPORTANT: Always use itemsPerPage when explicitly set by user (desktop pagination controls)
      // Only force 10 on mobile when using infinite scroll (mobile doesn't show pagination controls)
      // Check if we're actually on mobile by verifying window width at call time, not just state
      const isActuallyMobile = typeof window !== 'undefined' && window.innerWidth < 1024;
      const limit = isActuallyMobile ? 10 : itemsPerPage;
      params.append("page", currentPage.toString());
      params.append("limit", limit.toString());

      // Use API route to get transactions (descriptions are decrypted on server)
      // Add cache busting timestamp to force fresh data after deletions
      const queryString = params.toString();
      // OPTIMIZED: Add _forceRefresh parameter to bypass server-side unstable_cache
      // This forces getTransactions() to bypass cache by using search parameter trick
      const refreshParam = forceRefresh ? '&_forceRefresh=true' : '';
      const url = `/api/transactions${queryString ? `?${queryString}` : ''}${queryString ? '&' : '?'}_t=${Date.now()}${refreshParam}`;
      
      const response = await fetch(url, {
        // Force fresh fetch - cache is invalidated server-side but browser may still cache
        cache: 'no-store',
        signal: abortController.signal,
      });

      // Handle rate limiting (429)
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        const retrySeconds = retryAfter ? parseInt(retryAfter, 10) : 60;
        toast({
          title: "Too many requests",
          description: `Please wait ${retrySeconds} seconds before trying again.`,
          variant: "destructive",
        });
        // Retry after the specified delay
        setTimeout(() => {
          if (!abortController.signal.aborted) {
            loadTransactions();
          }
        }, retrySeconds * 1000);
        return;
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to fetch transactions");
      }

      // Check if request was aborted
      if (abortController.signal.aborted) {
        return;
      }

      const data = await response.json();
      
      // Handle both old format (array) and new format (object with transactions and total)
      let newTransactions: Transaction[] = [];
      if (Array.isArray(data)) {
        // Backward compatibility: if API returns array, use it directly
        newTransactions = data;
        setTotalTransactions(data.length);
      } else if (data.transactions && typeof data.total === 'number') {
        // New format with pagination
        newTransactions = data.transactions;
        setTotalTransactions(data.total);
      } else {
        logger.error("[TransactionsPage] Unexpected response format:", data);
        setTransactions([]);
        setTotalTransactions(0);
        return;
      }
      
      // OPTIMIZED: Handle pagination differently for mobile vs desktop
      // Mobile: accumulate transactions for infinite scroll
      // Desktop: always replace transactions (normal pagination)
      if (isMobile) {
        // Mobile infinite scroll: accumulate transactions
        if (currentPage === 1) {
          // First page: replace all (reset accumulated list)
          setTransactions(newTransactions);
          setAllTransactions(newTransactions);
        } else {
          // Subsequent pages: add to accumulated list for infinite scroll
          setTransactions(newTransactions);
          setAllTransactions(prev => {
            // Avoid duplicates by checking IDs
            const existingIds = new Set(prev.map(t => t.id));
            const uniqueNew = newTransactions.filter(t => !existingIds.has(t.id));
            return [...prev, ...uniqueNew];
          });
        }
      } else {
        // Desktop: always replace transactions (normal pagination)
        // Clear accumulated transactions to free memory
        setTransactions(newTransactions);
        // Only keep allTransactions if we're on page 1 (for consistency)
        if (currentPage === 1) {
          setAllTransactions(newTransactions);
        } else {
          // Clear accumulated transactions on desktop when navigating pages
          // This prevents memory buildup when user navigates between pages
          setAllTransactions([]);
        }
      }
      
      // Mark data as loaded for performance tracking
      perf.markDataLoaded();

      // Generate suggestions for existing transactions without category (only once per page load)
      // Defer this to avoid blocking initial page load
      if (!suggestionsGenerated) {
        const transactionsToCheck = Array.isArray(data) ? data : (data.transactions || []);
        const hasUncategorizedTransactions = transactionsToCheck.some((tx: Transaction) => !tx.categoryId && !tx.suggestedCategoryId);
        if (hasUncategorizedTransactions) {
          setSuggestionsGenerated(true);
          // Generate suggestions in the background after a delay to not block initial load
          // Use requestIdleCallback if available, otherwise setTimeout
          const generateSuggestions = () => {
            fetch("/api/transactions/generate-suggestions", { method: "POST" })
              .then(response => response.json())
              .then(result => {
                if (result.processed > 0) {
                  // Reload transactions to show the new suggestions after a delay
                  // Use a longer delay to avoid hitting rate limits
                  setTimeout(() => {
                    if (!abortControllerRef.current?.signal.aborted) {
                      loadTransactions();
                    }
                  }, 3000); // Increased delay to prevent rate limit issues
                }
              })
              .catch(error => {
                logger.error("Error generating suggestions:", error);
              });
          };
          
          // Use requestIdleCallback if available (browser API), otherwise setTimeout
          if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
            (window as any).requestIdleCallback(generateSuggestions, { timeout: 5000 });
          } else {
            setTimeout(generateSuggestions, 2000);
          }
        }
      }
    } catch (error) {
      // Don't log aborted requests as errors
      if (error instanceof Error && error.name === 'AbortError') {
        return;
      }
      logger.error("Error loading transactions:", error);
      toast({
        title: "Error loading transactions",
        description: error instanceof Error ? error.message : "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      // Only set loading to false if this request wasn't aborted
      if (!abortController.signal.aborted) {
        setLoading(false);
        // Also clear search loading if there was a search
        if (filters.search) {
          setSearchLoading(false);
        }
      }
      // Clear the abort controller reference if this was the active request
      if (abortControllerRef.current === abortController) {
        abortControllerRef.current = null;
      }
    }
  }

  function handleDelete(id: string) {
    // Check if user can perform write operations
    if (!checkWriteAccess()) {
      return;
    }
    openDeleteDialog(
      {
        title: "Delete Transaction",
        description: "This transaction will be permanently deleted. This action cannot be undone.",
        variant: "destructive",
        confirmLabel: "Delete",
      },
      async () => {
        const transactionToDelete = transactions.find(t => t.id === id);
        
        // Optimistic update: remove from UI immediately
        setTransactions(prev => prev.filter(t => t.id !== id));
        setDeletingId(id);

        try {
          const response = await fetch(`/api/v2/transactions/${id}`, {
            method: "DELETE",
          });

          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || "Failed to delete transaction");
          }

          toast({
            title: "Transaction deleted",
            description: "Your transaction has been deleted successfully.",
            variant: "success",
          });
          
          // Reload transactions immediately to ensure UI is in sync with database
          // This bypasses any browser cache by using cache: 'no-store'
          await loadTransactions();
          
          // Refresh router to update dashboard and other pages that depend on transactions
          // Do this after loadTransactions to ensure we have fresh data
          router.refresh();
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
        description: `${count} transaction${count > 1 ? 's will' : ' will'} be permanently deleted. This action cannot be undone.`,
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
          const response = await fetch("/api/v2/transactions/bulk", {
            method: "DELETE",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ ids: idsToDelete }),
          });

          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || "Failed to delete transactions");
          }

          toast({
            title: "Transactions deleted",
            description: `${count} transaction${count > 1 ? 's' : ''} deleted successfully.`,
            variant: "success",
          });
          
          // Reload transactions immediately to ensure UI is in sync with database
          // This bypasses any browser cache by using cache: 'no-store'
          await loadTransactions();
          
          // Refresh router to update dashboard and other pages that depend on transactions
          // Do this after loadTransactions to ensure we have fresh data
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

  async function handleBulkUpdateType(newType: "expense" | "income" | "transfer") {
    if (!checkWriteAccess()) {
      return;
    }

    const idsToUpdate = Array.from(selectedTransactionIds);
    if (idsToUpdate.length === 0) return;

    const transactionsToUpdate = transactions.filter(t => idsToUpdate.includes(t.id));
    
    // Optimistic update: update type in UI immediately
    setTransactions(prev => prev.map(tx => 
      idsToUpdate.includes(tx.id) 
        ? { ...tx, type: newType }
        : tx
    ));
    setUpdatingTypes(true);

    try {
      const response = await fetch("/api/v2/transactions/bulk", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ transactionIds: idsToUpdate, type: newType }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update transactions");
      }

      const result = await response.json();

      toast({
        title: "Transactions updated",
        description: `${result.success} transaction${result.success > 1 ? 's' : ''} updated to ${newType} successfully.`,
        variant: "success",
      });
      
      // Clear selection
      setSelectedTransactionIds(new Set());
      
      // Refresh router to update dashboard and other pages that depend on transactions
      router.refresh();
      
      // Reload transactions to ensure UI is in sync with database
      loadTransactions();
    } catch (error) {
      console.error("Error updating transaction types:", error);
      // Revert optimistic update on error
      setTransactions(prev => prev.map(tx => {
        const original = transactionsToUpdate.find(t => t.id === tx.id);
        return original ? original : tx;
      }));
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update transaction types",
        variant: "destructive",
      });
    } finally {
      setUpdatingTypes(false);
    }
  }

  async function loadSubcategoriesForBulk(categoryId: string): Promise<Array<{ id: string; name: string }>> {
    try {
      const response = await fetch(`/api/categories?categoryId=${categoryId}`);
      if (response.ok) {
        const data = await response.json();
        return data || [];
      }
    } catch (error) {
      logger.error("Error loading subcategories:", error);
    }
    return [];
  }

  async function handleBulkUpdateCategory(categoryId: string | null, subcategoryId: string | null = null) {
    if (!checkWriteAccess()) {
      return;
    }

    const idsToUpdate = Array.from(selectedTransactionIds);
    if (idsToUpdate.length === 0) return;

    const transactionsToUpdate = transactions.filter(t => idsToUpdate.includes(t.id));
    
    // Find the category object to update UI
    const selectedCategory = categoryId ? categories.find(c => c.id === categoryId) : null;
    const selectedSubcategory = subcategoryId && selectedCategory 
      ? selectedCategory.subcategories?.find(s => s.id === subcategoryId) 
      : null;
    
    // Optimistic update: update category in UI immediately
    setTransactions(prev => prev.map(tx => 
      idsToUpdate.includes(tx.id) 
        ? { 
            ...tx, 
            categoryId: categoryId || undefined,
            subcategoryId: subcategoryId || undefined,
            category: selectedCategory || undefined,
            subcategory: selectedSubcategory || undefined,
          }
        : tx
    ));
    setUpdatingCategories(true);

    try {
      const response = await fetch("/api/v2/transactions/bulk", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ 
          transactionIds: idsToUpdate, 
          categoryId: categoryId || null,
          subcategoryId: subcategoryId || null,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update transaction categories");
      }

      const result = await response.json();

      toast({
        title: "Categories updated",
        description: `${result.success} transaction${result.success > 1 ? 's' : ''} categor${result.success > 1 ? 'ies' : 'y'} updated successfully.`,
        variant: "success",
      });
      
      // Clear selection
      setSelectedTransactionIds(new Set());
      
      // Refresh router to update dashboard and other pages that depend on transactions
      router.refresh();
      
      // Reload transactions to ensure UI is in sync with database
      loadTransactions();
    } catch (error) {
      console.error("Error updating transaction categories:", error);
      // Revert optimistic update on error
      setTransactions(prev => prev.map(tx => {
        const original = transactionsToUpdate.find(t => t.id === tx.id);
        return original ? original : tx;
      }));
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update transaction categories",
        variant: "destructive",
      });
    } finally {
      setUpdatingCategories(false);
    }
  }

  async function handleCategoryUpdate(categoryId: string | null, subcategoryId: string | null = null) {
    if (!transactionForCategory) return;

    // Store transaction reference before async operations
    const transactionToUpdate = transactionForCategory;

    try {
      // Build update data
      const updateData: { categoryId?: string | null; subcategoryId?: string | null } = {};
      updateData.categoryId = categoryId;
      updateData.subcategoryId = subcategoryId || null;

      const response = await fetch(`/api/v2/transactions/${transactionToUpdate.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updateData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update transaction");
      }

      // Update category/subcategory names in the transaction without reloading
      if (categoryId) {
        const updatedCategory = categories.find(c => c.id === categoryId);
        if (updatedCategory) {
          setTransactions(prev => prev.map(tx => 
            tx.id === transactionToUpdate.id 
              ? { 
                  ...tx, 
                  categoryId: categoryId || undefined, 
                  subcategoryId: subcategoryId || undefined,
                  category: updatedCategory,
                  subcategory: subcategoryId ? updatedCategory.subcategories?.find(s => s.id === subcategoryId) : undefined
                }
              : tx
          ));
        }
      } else {
        // If category is cleared, remove category and subcategory objects
        setTransactions(prev => prev.map(tx => 
          tx.id === transactionToUpdate.id 
            ? { 
                ...tx, 
                categoryId: undefined, 
                subcategoryId: undefined,
                category: undefined,
                subcategory: undefined
              }
            : tx
        ));
      }

      toast({
        title: "Category updated",
        description: "The transaction category has been updated successfully.",
        variant: "success",
      });

      setIsCategoryModalOpen(false);
      setTransactionForCategory(null);
      
      // Don't refresh router here to avoid triggering unnecessary reloads
      // The dashboard will update on next navigation or manual refresh
    } catch (error) {
      console.error("Error updating category:", error);
      
      // Revert optimistic update
      setTransactions(prev => prev.map(tx => 
        tx.id === transactionToUpdate.id 
          ? transactionToUpdate
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
    // The database is the source of truth - if a feature is disabled in Supabase, it should be disabled here
    // Safety check: convert string "true" to boolean (defensive programming)
    const hasAccess = limits.hasCsvExport === true || String(limits.hasCsvExport) === "true";
    
    if (!hasAccess) {
      toast({
        title: "CSV Export Not Available",
        description: "CSV export is not available in your current plan.",
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
      setSelectedTransactionIds(prev => {
        const newSet = new Set(prev);
        paginatedTransactions.forEach(tx => newSet.add(tx.id));
        return newSet;
      });
    } else {
      setSelectedTransactionIds(prev => {
        const newSet = new Set(prev);
        paginatedTransactions.forEach(tx => newSet.delete(tx.id));
        return newSet;
      });
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

  // Pagination calculations - now using server-side pagination
  // totalPages is calculated earlier to avoid reference errors
  
  // For desktop: use paginated transactions from server
  // For mobile: use accumulated transactions for infinite scroll
  const paginatedTransactions = transactions;
  const mobileTransactions = allTransactions.length > 0 ? allTransactions : transactions;
  
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalTransactions);

  const allSelected = paginatedTransactions.length > 0 && paginatedTransactions.every(tx => selectedTransactionIds.has(tx.id));
  const someSelected = paginatedTransactions.some(tx => selectedTransactionIds.has(tx.id)) && !allSelected;

  // Adjust current page if it's out of bounds
  useEffect(() => {
    if (totalPages > 0 && currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [totalPages, currentPage]);

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

  function handleStartEditingDate(transaction: Transaction) {
    if (!checkWriteAccess()) {
      return;
    }
    // Cancel any ongoing description editing
    if (editingDescriptionId) {
      handleCancelEditingDescription();
    }
    const dateStr = formatDateInput(transaction.date);
    setEditingDateId(transaction.id);
    setEditingDateValue(dateStr);
  }

  function handleStartEditingDescription(transaction: Transaction) {
    if (!checkWriteAccess()) {
      return;
    }
    // Cancel any ongoing date editing
    if (editingDateId) {
      handleCancelEditingDate();
    }
    setEditingDescriptionId(transaction.id);
    setEditingDescriptionValue(transaction.description || "");
  }

  function handleCancelEditingDate() {
    setEditingDateId(null);
    setEditingDateValue("");
  }

  function handleCancelEditingDescription() {
    setEditingDescriptionId(null);
    setEditingDescriptionValue("");
  }

  async function handleSaveDate(transactionId: string) {
    if (!editingDateValue) {
      handleCancelEditingDate();
      return;
    }

    const transaction = transactions.find(tx => tx.id === transactionId);
    if (!transaction) return;

    // Parse date string (YYYY-MM-DD) as local date to avoid timezone issues
    const newDate = parseDateInput(editingDateValue);
    if (isNaN(newDate.getTime())) {
      toast({
        title: "Invalid date",
        description: "Please enter a valid date.",
        variant: "destructive",
      });
      return;
    }

    setUpdatingTransactionId(transactionId);

    // Convert Date to YYYY-MM-DD string format (same as form does)
    // This ensures we send date-only strings to the backend, avoiding timezone issues
    const dateString = formatDateInput(newDate);

    // Optimistic update
    setTransactions(prev => prev.map(tx => 
      tx.id === transactionId 
        ? { ...tx, date: newDate.toISOString() }
        : tx
    ));

    try {
      const response = await fetch(`/api/transactions/${transactionId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ date: dateString }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update date");
      }

      toast({
        title: "Date updated",
        description: "The transaction date has been updated successfully.",
        variant: "success",
      });

      setEditingDateId(null);
      setEditingDateValue("");
      
      // No need to reload - optimistic update already handled it
      // Only refresh router to update dashboard
      router.refresh();
    } catch (error) {
      console.error("Error updating date:", error);
      
      // Revert optimistic update
      if (transaction) {
        setTransactions(prev => prev.map(tx => 
          tx.id === transactionId ? transaction : tx
        ));
      }

      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update date",
        variant: "destructive",
      });
    } finally {
      setUpdatingTransactionId(null);
    }
  }

  async function handleSaveDescription(transactionId: string) {
    const transaction = transactions.find(tx => tx.id === transactionId);
    if (!transaction) return;

    setUpdatingTransactionId(transactionId);

    // Optimistic update
    setTransactions(prev => prev.map(tx => 
      tx.id === transactionId 
        ? { ...tx, description: editingDescriptionValue }
        : tx
    ));

    try {
      const response = await fetch(`/api/transactions/${transactionId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ description: editingDescriptionValue || null }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update description");
      }

      toast({
        title: "Description updated",
        description: "The transaction description has been updated successfully.",
        variant: "success",
      });

      setEditingDescriptionId(null);
      setEditingDescriptionValue("");
      
      // No need to reload - optimistic update already handled it
      // Only refresh router to update dashboard
      router.refresh();
    } catch (error) {
      console.error("Error updating description:", error);
      
      // Revert optimistic update
      if (transaction) {
        setTransactions(prev => prev.map(tx => 
          tx.id === transactionId ? transaction : tx
        ));
      }

      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update description",
        variant: "destructive",
      });
    } finally {
      setUpdatingTransactionId(null);
    }
  }


  // Count active filters
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (dateRange !== "all-dates" || customDateRange) count++;
    if (filters.accountId !== "all") count++;
    if (filters.type !== "all") count++;
    if (filters.search) count++;
    if (filters.categoryId !== "all") count++;
    if (filters.recurring !== "all") count++;
    return count;
  }, [dateRange, customDateRange, filters]);

  // Default to "expense" if type is "all" (for display purposes)
  const activeTab = filters.type === "all" ? "expense" : filters.type;
  
  return (
    <SimpleTabs 
      value={activeTab} 
      onValueChange={(value) => setFilters({ ...filters, type: value })}
      className="w-full"
    >
      <PageHeader
        title="Transactions"
      >
          <div className="flex flex-wrap gap-3 justify-center md:justify-end">
          {selectedTransactionIds.size > 0 && (
            <>
              <Select
                onValueChange={(value) => {
                  if (value && ["expense", "income", "transfer"].includes(value)) {
                    handleBulkUpdateType(value as "expense" | "income" | "transfer");
                  }
                }}
                disabled={updatingTypes || updatingCategories}
              >
                <SelectTrigger className="h-9 w-auto min-w-[140px] text-xs">
                  <SelectValue placeholder={updatingTypes ? "Updating..." : `Change Type (${selectedTransactionIds.size})`} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="expense">Expense</SelectItem>
                  <SelectItem value="income">Income</SelectItem>
                  <SelectItem value="transfer">Transfer</SelectItem>
                </SelectContent>
              </Select>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="medium"
                    disabled={updatingTypes || updatingCategories}
                    className="h-9 w-auto min-w-[160px] text-xs"
                  >
                    {updatingCategories ? "Updating..." : `Set Category (${selectedTransactionIds.size})`}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-56 max-h-[400px] overflow-y-auto">
                  <DropdownMenuItem
                    onClick={() => handleBulkUpdateCategory(null)}
                    className="text-xs"
                  >
                    Clear Category
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {categories.map((category) => {
                    const hasSubcategories = category.subcategories && category.subcategories.length > 0;
                    
                    // If category has subcategories, show submenu
                    if (hasSubcategories && category.subcategories) {
                      return (
                        <DropdownMenuSub key={category.id}>
                          <DropdownMenuSubTrigger className="text-xs">
                            {category.name}
                          </DropdownMenuSubTrigger>
                          <DropdownMenuSubContent>
                            <DropdownMenuItem
                              onClick={() => handleBulkUpdateCategory(category.id, null)}
                              className="text-xs"
                            >
                              No Subcategory
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {category.subcategories.map((subcategory) => (
                              <DropdownMenuItem
                                key={subcategory.id}
                                onClick={() => handleBulkUpdateCategory(category.id, subcategory.id)}
                                className="text-xs"
                              >
                                {subcategory.name}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuSubContent>
                        </DropdownMenuSub>
                      );
                    }
                    
                    // If no subcategories, check if we need to load them
                    return (
                      <CategoryMenuItem
                        key={category.id}
                        category={category}
                        onSelect={(categoryId, subcategoryId) => {
                          handleBulkUpdateCategory(categoryId, subcategoryId);
                        }}
                        loadSubcategories={loadSubcategoriesForBulk}
                      />
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
              <Button 
                variant="destructive"
                size="medium"
                onClick={handleDeleteMultiple}
                disabled={deletingMultiple || updatingTypes || updatingCategories}
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
            </>
          )}
          <Button 
            variant="outline"
            size="icon"
            onClick={handleSyncAll}
            disabled={syncingAll}
            className="h-9 w-9"
            title="Sync Accounts"
          >
            {syncingAll ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="outline" 
                size="medium" 
                className="text-xs md:text-sm"
              >
                <Download className="h-3 w-3 md:h-4 md:w-4 md:mr-2" />
                <span className="hidden md:inline">Manual Data</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Manual Data</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => {
                  // Check if user has access to CSV import
                  const hasAccess = limits.hasCsvImport === true || String(limits.hasCsvImport) === "true";
                  if (!hasAccess) {
                    setShowImportUpgradeModal(true);
                    return;
                  }
                  setIsImportOpen(true);
                }}
              >
                <Upload className="h-4 w-4 mr-2" />
                Import CSV
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={handleExport}
                disabled={transactions.length === 0}
              >
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button 
            variant="outline"
            size="small"
            onClick={() => setIsFiltersModalOpen(true)} 
            className="text-xs md:text-sm"
          >
            <Filter className="h-3 w-3 md:h-4 md:w-4 md:mr-2" />
            <span className="hidden md:inline">Filters</span>
            {(filters.accountId !== "all" || filters.search || filters.recurring !== "all" || dateRange !== "all-dates" || customDateRange || filters.categoryId !== "all") && (
              <Badge variant="secondary" className="ml-2 h-5 px-1.5 text-[10px]">
                Active
              </Badge>
            )}
          </Button>
          {canWrite && (
            <Button 
              size="medium" 
              onClick={() => {
                if (!checkWriteAccess()) {
                  return;
                }
                setSelectedTransaction(null);
                setIsFormOpen(true);
              }} 
              className="text-xs md:text-sm hidden lg:flex"
            >
              <Plus className="h-3 w-3 md:h-4 md:w-4 md:mr-2" />
              <span className="hidden md:inline">Add Transaction</span>
            </Button>
          )}
        </div>
      </PageHeader>

      <ImportStatusBanner />

      {/* Fixed Tabs - Desktop only */}
      <FixedTabsWrapper>
        <SimpleTabsList>
          <SimpleTabsTrigger value="expense">Expense</SimpleTabsTrigger>
          <SimpleTabsTrigger value="income">Income</SimpleTabsTrigger>
          <SimpleTabsTrigger value="transfer">Transfer</SimpleTabsTrigger>
        </SimpleTabsList>
      </FixedTabsWrapper>

      {/* Mobile/Tablet Tabs - Sticky at top */}
      <div 
        className="lg:hidden sticky top-0 z-40 bg-card dark:bg-transparent border-b"
      >
        <div 
          className="overflow-x-auto scrollbar-hide" 
          style={{ 
            WebkitOverflowScrolling: 'touch',
            scrollSnapType: 'x mandatory',
            touchAction: 'pan-x',
          }}
        >
          <SimpleTabsList className="min-w-max px-4" style={{ scrollSnapAlign: 'start' }}>
            <SimpleTabsTrigger value="expense" className="flex-shrink-0 whitespace-nowrap">
              Expense
            </SimpleTabsTrigger>
            <SimpleTabsTrigger value="income" className="flex-shrink-0 whitespace-nowrap">
              Income
            </SimpleTabsTrigger>
            <SimpleTabsTrigger value="transfer" className="flex-shrink-0 whitespace-nowrap">
              Transfer
            </SimpleTabsTrigger>
          </SimpleTabsList>
        </div>
      </div>

      {/* Content Container */}
      <div className="w-full lg:p-8">
        {/* Mobile Card View */}
        <div className="lg:hidden" ref={pullToRefreshRef}>
        {/* Pull to refresh indicator */}
        {pullDistance > 0 && (
          <div 
            className="flex items-center justify-center py-4 transition-opacity"
            style={{ 
              opacity: Math.min(pullDistance / 60, 1),
              transform: `translateY(${Math.min(pullDistance, 60)}px)`
          }}
        >
            {isRefreshing ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Refreshing...</span>
              </div>
            ) : pullDistance >= 60 ? (
              <div className="text-sm text-muted-foreground">Release to refresh</div>
            ) : (
              <div className="text-sm text-muted-foreground">Pull to refresh</div>
                    )}
                  </div>
        )}
        
        {loading && !searchLoading && currentPage === 1 && !isRefreshing ? (
          <div className="text-center py-8 text-muted-foreground">
            Loading transactions...
          </div>
        ) : mobileTransactions.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No transactions found
          </div>
        ) : (
          <>
            {mobileTransactions.map((tx) => {
            const plaidMeta = tx.plaidMetadata as any;
            return (
              <TransactionsMobileCard
                key={tx.id}
                transaction={tx}
                isSelected={selectedTransactionIds.has(tx.id)}
                onSelect={(checked) => handleSelectTransaction(tx.id, checked)}
                onEdit={() => {
                  // Check if user can perform write operations
                  if (!checkWriteAccess()) {
                    return;
                  }
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
            {/* Load More button for mobile */}
            {isMobile && currentPage < totalPages && (
              <div className="flex items-center justify-center py-6">
                <Button
                  onClick={handleLoadMore}
                  disabled={loading || loadingMore}
                  variant="outline"
                  className="w-full max-w-xs"
                >
                  {loadingMore ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    "Load More"
                  )}
                </Button>
              </div>
            )}
          </>
        )}
        </div>

        {/* Desktop/Tablet Table View */}
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
              <TableHead className="text-right text-xs md:text-sm">Amount</TableHead>
              <TableHead className="text-xs md:text-sm">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && !searchLoading ? (
              <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  Loading transactions...
                </TableCell>
              </TableRow>
            ) : transactions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  No transactions found
                </TableCell>
              </TableRow>
            ) : (
              paginatedTransactions.map((tx) => {
                const plaidMeta = tx.plaidMetadata as any;
                // Support both camelCase (new) and snake_case (old) for backward compatibility
                const isPending = plaidMeta?.pending;
                const authorizedDate = plaidMeta?.authorizedDate || plaidMeta?.authorizedDatetime || 
                                      plaidMeta?.authorized_date || plaidMeta?.authorized_datetime;
                const currencyCode = plaidMeta?.isoCurrencyCode || plaidMeta?.unofficialCurrencyCode ||
                                     plaidMeta?.iso_currency_code || plaidMeta?.unofficial_currency_code;
                
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
                  {editingDateId === tx.id ? (
                    <div className="flex items-center gap-1">
                      <Input
                        ref={(el) => {
                          if (el) {
                            dateInputRefs.current.set(tx.id, el);
                          } else {
                            dateInputRefs.current.delete(tx.id);
                          }
                        }}
                        type="date"
                        value={editingDateValue}
                        onChange={(e) => setEditingDateValue(e.target.value)}
                        onBlur={() => {
                          if (editingDateId === tx.id) {
                            handleSaveDate(tx.id);
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleSaveDate(tx.id);
                          } else if (e.key === "Escape") {
                            e.preventDefault();
                            handleCancelEditingDate();
                          }
                        }}
                        className="h-7 text-xs"
                        disabled={updatingTransactionId === tx.id}
                      />
                      {updatingTransactionId === tx.id && (
                        <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                      )}
                    </div>
                  ) : (
                    <div 
                      className="flex flex-col gap-0.5 cursor-pointer hover:bg-muted/50 rounded px-1 py-0.5 -mx-1 transition-colors"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        handleStartEditingDate(tx);
                      }}
                      title="Click to edit date"
                    >
                      <span>{formatTransactionDate(tx.date)}</span>
                      {authorizedDate && (
                        <span className="text-[10px] text-muted-foreground">
                          Auth: {formatShortDate(authorizedDate)}
                        </span>
                      )}
                    </div>
                  )}
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
                    <Button
                      type="button"
                      variant="link"
                      size="small"
                      className="text-blue-600 dark:text-blue-400 underline decoration-dashed underline-offset-2"
                      onClick={() => {
                        setTransactionForCategory(tx);
                        setSelectedCategoryId(tx.categoryId || null);
                        setSelectedSubcategoryId(tx.subcategoryId || null);
                        setIsCategoryModalOpen(true);
                      }}
                    >
                      Add Category
                    </Button>
                  )}
                </TableCell>
                <TableCell className="text-xs md:text-sm hidden lg:table-cell max-w-[150px]">
                  {editingDescriptionId === tx.id ? (
                    <div className="flex items-center gap-1">
                      <Input
                        ref={(el) => {
                          if (el) {
                            descriptionInputRefs.current.set(tx.id, el);
                          } else {
                            descriptionInputRefs.current.delete(tx.id);
                          }
                        }}
                        type="text"
                        value={editingDescriptionValue}
                        onChange={(e) => setEditingDescriptionValue(e.target.value)}
                        onBlur={() => {
                          if (editingDescriptionId === tx.id) {
                            handleSaveDescription(tx.id);
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleSaveDescription(tx.id);
                          } else if (e.key === "Escape") {
                            e.preventDefault();
                            handleCancelEditingDescription();
                          }
                        }}
                        className="h-7 text-xs"
                        disabled={updatingTransactionId === tx.id}
                      />
                      {updatingTransactionId === tx.id && (
                        <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                      )}
                    </div>
                  ) : (
                    <span 
                      className="truncate block cursor-pointer hover:bg-muted/50 rounded px-1 py-0.5 -mx-1 transition-colors"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        handleStartEditingDescription(tx);
                      }}
                      title="Click to edit description"
                    >
                      {tx.description || "-"}
                    </span>
                  )}
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
                  {canWrite && (
                    <div className="flex space-x-1 md:space-x-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 md:h-10 md:w-10"
                        onClick={() => {
                          // Check if user can perform write operations
                          if (!checkWriteAccess()) {
                            return;
                          }
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
                  )}
                </TableCell>
              </TableRow>
              );
              })
            )}
          </TableBody>
        </Table>
        </div>

        {/* Pagination Controls - Desktop only */}
        {transactions.length > 0 && (
          <div className="hidden lg:flex flex-col sm:flex-row items-center justify-between gap-4 px-2 mt-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Items per page:</span>
            <Select
              value={itemsPerPage.toString()}
              onValueChange={(value) => {
                setItemsPerPage(Number(value));
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className="h-9 w-[80px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="20">20</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>
              Showing {startIndex + 1} to {Math.min(endIndex, totalTransactions)} of {totalTransactions} transactions
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="small"
              onClick={() => {
                const newPage = Math.max(1, currentPage - 1);
                setCurrentPage(newPage);
                // OPTIMIZED: Clear accumulated transactions on desktop when navigating pages
                if (!isMobile && newPage !== currentPage) {
                  setAllTransactions([]);
                }
              }}
              disabled={currentPage === 1 || loading}
              className="h-9"
            >
              <ChevronLeft className="h-4 w-4" />
              <span className="hidden sm:inline ml-1">Previous</span>
            </Button>
            
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum: number;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }
                
                return (
                  <Button
                    key={pageNum}
                    variant={currentPage === pageNum ? "default" : "outline"}
                    size="small"
                    onClick={() => {
                      setCurrentPage(pageNum);
                      // OPTIMIZED: Clear accumulated transactions on desktop when navigating pages
                      if (!isMobile && pageNum !== currentPage) {
                        setAllTransactions([]);
                      }
                    }}
                    disabled={loading}
                    className="h-9 w-9"
                  >
                    {pageNum}
                  </Button>
                );
              })}
            </div>
            
            <Button
              variant="outline"
              size="small"
              onClick={() => {
                const newPage = Math.min(totalPages, currentPage + 1);
                setCurrentPage(newPage);
                // OPTIMIZED: Clear accumulated transactions on desktop when navigating pages
                if (!isMobile && newPage !== currentPage) {
                  setAllTransactions([]);
                }
              }}
              disabled={currentPage === totalPages || loading}
              className="h-9"
            >
              <span className="hidden sm:inline mr-1">Next</span>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
        )}
      </div>


      <TransactionForm
        open={isFormOpen}
        onOpenChange={(open) => {
          setIsFormOpen(open);
          if (!open) {
            // Clear selected transaction when form closes
            setSelectedTransaction(null);
          }
        }}
        transaction={selectedTransaction}
        onSuccess={async () => {
          // Close form and clear selection first
          setSelectedTransaction(null);
          
          // CRITICAL: Wait to ensure server cache invalidation has fully propagated
          // unstable_cache can take time to invalidate even after revalidateTag is called
          // Increased delay to ensure cache is properly invalidated before reloading
          await new Promise(resolve => setTimeout(resolve, 800));
          
          // Refresh router to update dashboard immediately
          // This ensures the dashboard shows the new transaction without waiting for realtime subscription
          router.refresh();
          
          // Reset to first page for fresh reload
          // Don't clear transactions yet - let loadTransactions replace them with fresh data
          setCurrentPage(1);
          
          // Reload transactions with force refresh AFTER router refresh
          // This ensures we get fresh data after cache invalidation
          // forceRefresh=true bypasses unstable_cache by using search parameter trick
          // Additional delay to ensure router.refresh has processed and cache is cleared
          await new Promise(resolve => setTimeout(resolve, 500));
          await loadTransactions(true);
          
          // Clear accumulated transactions after successful reload
          // loadTransactions will set allTransactions correctly when currentPage === 1
        }}
      />

      <CsvImportDialog
        open={isImportOpen}
        onOpenChange={setIsImportOpen}
        onSuccess={loadTransactions}
        accounts={accounts}
        categories={categories}
      />

      {/* CSV Import Upgrade Modal */}
      <Dialog open={showImportUpgradeModal} onOpenChange={setShowImportUpgradeModal}>
        <DialogContent className="max-w-5xl sm:max-w-5xl md:max-w-6xl lg:max-w-7xl max-h-[90vh] overflow-y-auto p-0 gap-0">
          <DialogHeader className="sr-only">
            <DialogTitle>Upgrade to CSV Import</DialogTitle>
          </DialogHeader>
          <div className="p-4 sm:p-6 md:p-8">
            <BlockedFeature feature="hasCsvImport" featureName="CSV Import" />
          </div>
        </DialogContent>
      </Dialog>

      {/* Filters Modal */}
      <Dialog open={isFiltersModalOpen} onOpenChange={setIsFiltersModalOpen}>
        <DialogContent className="max-w-md flex flex-col p-0 max-h-[90vh]">
          <DialogHeader className="px-6 pt-6 pb-4 flex-shrink-0 text-left border-b">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <DialogTitle className="text-xl font-semibold">Filters</DialogTitle>
                  {activeFiltersCount > 0 && (
                    <Badge variant="secondary" className="h-5 px-2 text-xs font-medium">
                      {activeFiltersCount} active
                    </Badge>
                  )}
                </div>
                <DialogDescription className="mt-1.5 text-sm text-muted-foreground">
                  Filter your transactions by date, account, type, and search terms
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          
          <div className="space-y-6 px-6 py-4 overflow-y-auto flex-1">
            {/* Date Range */}
            <div className="space-y-2.5">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <label className="text-sm font-medium">Date Range</label>
              </div>
              <DateRangePicker
                value={dateRange}
                dateRange={customDateRange}
                onValueChange={handleDateRangeChange}
              />
            </div>

            {/* Account */}
            <div className="space-y-2.5">
              <div className="flex items-center gap-2">
                <Wallet className="h-4 w-4 text-muted-foreground" />
                <label className="text-sm font-medium">Account</label>
              </div>
              <Select
                value={filters.accountId}
                onValueChange={(value) => setFilters({ ...filters, accountId: value })}
              >
                <SelectTrigger className="h-10 w-full">
                  <SelectValue placeholder="Select an account" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Accounts</SelectItem>
                  {accounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Type */}
            <div className="space-y-2.5">
              <div className="flex items-center gap-2">
                <Type className="h-4 w-4 text-muted-foreground" />
                <label className="text-sm font-medium">Type</label>
              </div>
              <Select
                value={filters.type}
                onValueChange={(value) => setFilters({ ...filters, type: value })}
              >
                <SelectTrigger className="h-10 w-full">
                  <SelectValue placeholder="Select a type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="expense">Expense</SelectItem>
                  <SelectItem value="income">Income</SelectItem>
                  <SelectItem value="transfer">Transfer</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Search */}
            <div className="space-y-2.5">
              <div className="flex items-center gap-2">
                <Search className="h-4 w-4 text-muted-foreground" />
                <label className="text-sm font-medium">Search</label>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  placeholder="Search transactions..."
                  value={filters.search}
                  onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                  className="h-10 w-full pl-9 pr-10"
                />
                {filters.search && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setFilters({ ...filters, search: "" })}
                    className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8"
                    aria-label="Clear search"
                  >
                    <XCircle className="h-4 w-4 text-muted-foreground" />
                  </Button>
                )}
                {searchLoading && !filters.search && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                )}
              </div>
            </div>

            {/* Category */}
            <div className="space-y-2.5">
              <div className="flex items-center gap-2">
                <Tag className="h-4 w-4 text-muted-foreground" />
                <label className="text-sm font-medium">Category</label>
              </div>
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant={filters.categoryId === "all" ? "default" : "outline"}
                    onClick={() => setFilters({ ...filters, categoryId: "all" })}
                    className="rounded-full h-9 px-4 text-xs font-medium transition-all hover:scale-105"
                    size="small"
                  >
                    All
                  </Button>
                  {categories
                    .filter((category) => activeCategoryIds.has(category.id))
                    .map((category) => (
                      <Button
                        key={category.id}
                        type="button"
                        variant={filters.categoryId === category.id ? "default" : "outline"}
                        onClick={() => setFilters({ ...filters, categoryId: category.id })}
                        className="rounded-full h-9 px-4 text-xs font-medium transition-all hover:scale-105"
                        size="small"
                      >
                        {category.name}
                        {filters.categoryId === category.id && (
                          <Check className="h-3 w-3 ml-1.5" />
                        )}
                      </Button>
                    ))}
                </div>
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
                  <SelectTrigger className="h-10 w-full border-dashed hover:border-primary/50 transition-colors">
                    <div className="flex items-center gap-2">
                      <Plus className="h-4 w-4 text-muted-foreground" />
                      <SelectValue placeholder="Add category to filter" />
                    </div>
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
            </div>
          </div>

          <DialogFooter className="px-6 pb-6 pt-4 border-t flex-shrink-0 bg-background flex-row gap-3">
            <Button
              variant="outline"
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
                setActiveCategoryIds(new Set());
              }}
              className="flex-1 h-10"
            >
              <XCircle className="h-4 w-4 mr-2" />
              Clear All
            </Button>
            <Button 
              onClick={() => setIsFiltersModalOpen(false)} 
              className="flex-1 h-10"
            >
              Apply Filters
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Category Selection Modal */}
      <CategorySelectionDialog
        open={isCategoryModalOpen}
        onOpenChange={setIsCategoryModalOpen}
        transaction={transactionForCategory}
        categories={categories}
        selectedCategoryId={selectedCategoryId}
        selectedSubcategoryId={selectedSubcategoryId}
        onCategorySelect={(categoryId, subcategoryId) => {
          setSelectedCategoryId(categoryId);
          setSelectedSubcategoryId(subcategoryId);
        }}
        onClear={() => {
          setSelectedCategoryId(null);
          setSelectedSubcategoryId(null);
          setClearCategoryTrigger(prev => prev + 1);
        }}
        onSave={() => {
          handleCategoryUpdate(selectedCategoryId, selectedSubcategoryId);
        }}
        clearTrigger={clearCategoryTrigger}
      />
      {DeleteConfirmDialog}
      {DeleteMultipleConfirmDialog}


    </SimpleTabs>
  );
}

