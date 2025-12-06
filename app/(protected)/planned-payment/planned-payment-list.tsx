"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/components/common/money";
import { format, differenceInDays, isToday, isTomorrow } from "date-fns";
import { cn } from "@/lib/utils";
import { Calendar, Check, X, SkipForward, ArrowRight, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useToast } from "@/components/toast-provider";
import type { BasePlannedPayment as PlannedPayment } from "@/src/domain/planned-payments/planned-payments.types";
import { PLANNED_HORIZON_DAYS } from "@/src/domain/planned-payments/planned-payments.types";
import { Loader2 } from "lucide-react";
import { TransactionForm } from "@/components/forms/transaction-form";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreVertical } from "lucide-react";
import { FixedTabsWrapper } from "@/components/common/fixed-tabs-wrapper";
import { PageHeader } from "@/components/common/page-header";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  SimpleTabs,
  SimpleTabsList,
  SimpleTabsTrigger,
  SimpleTabsContent,
} from "@/components/ui/simple-tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function PlannedPaymentList() {
  const { toast } = useToast();
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
  const [payments, setPayments] = useState<PlannedPayment[]>([]);
  const [totalPayments, setTotalPayments] = useState(0);
  const [activeTab, setActiveTab] = useState<"expense" | "income" | "transfer">("expense");
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [allPayments, setAllPayments] = useState<PlannedPayment[]>([]); // Accumulated payments for mobile
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Counts by type (for tab badges)
  const [expenseCount, setExpenseCount] = useState(0);
  const [incomeCount, setIncomeCount] = useState(0);
  const [transferCount, setTransferCount] = useState(0);
  
  const pullToRefreshRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef<number>(0);
  const touchCurrentY = useRef<number>(0);
  const isPulling = useRef<boolean>(false);
  const currentPullDistance = useRef<number>(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Calculate totalPages
  const totalPages = useMemo(() => {
    return Math.ceil(totalPayments / itemsPerPage);
  }, [totalPayments, itemsPerPage]);

  // Sort payments by date (earliest first)
  // Since API already filters by type, we can use payments directly
  const sortedPayments = useMemo(() => {
    return [...payments].sort((a, b) => {
      const dateA = a.date instanceof Date ? a.date : new Date(a.date);
      const dateB = b.date instanceof Date ? b.date : new Date(b.date);
      return dateA.getTime() - dateB.getTime();
    });
  }, [payments]);
  
  // For mobile: use accumulated payments for infinite scroll
  const mobilePayments = useMemo(() => {
    const paymentsToUse = allPayments.length > 0 ? allPayments : payments;
    return [...paymentsToUse].sort((a, b) => {
      const dateA = a.date instanceof Date ? a.date : new Date(a.date);
      const dateB = b.date instanceof Date ? b.date : new Date(b.date);
      return dateA.getTime() - dateB.getTime();
    });
  }, [allPayments, payments]);

  // Since API already filters by type, use sortedPayments directly for each tab
  const expensePayments = useMemo(() => {
    return sortedPayments;
  }, [sortedPayments]);

  const incomePayments = useMemo(() => {
    return sortedPayments;
  }, [sortedPayments]);

  const transferPayments = useMemo(() => {
    return sortedPayments;
  }, [sortedPayments]);

  // Mobile detection state
  const [isMobile, setIsMobile] = useState(false);

  // Update mobile detection on mount and window resize
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const syncPlannedPayments = useCallback(async () => {
    try {
      // Sync planned payments from all sources (debts, goals, recurring)
      const response = await fetch("/api/v2/planned-payments/sync", {
        method: "POST",
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to sync planned payments");
      }
      
      const data = await response.json();
      console.log("[PlannedPaymentList] Sync completed:", data);
    } catch (error) {
      // Don't show error to user, just log it
      // Sync is optional and shouldn't block the page from loading
      console.error("Error syncing planned payments:", error);
    }
  }, []);

  const loadCounts = useCallback(async () => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const horizonDate = new Date(today);
      horizonDate.setDate(horizonDate.getDate() + PLANNED_HORIZON_DAYS);
      
      // Single optimized call to get all counts at once
      const response = await fetch(
        `/api/planned-payments/counts?startDate=${today.toISOString().split('T')[0]}&endDate=${horizonDate.toISOString().split('T')[0]}&status=scheduled`
      );
      
      if (!response.ok) {
        throw new Error("Failed to fetch counts");
      }
      
      const data = await response.json();
      setExpenseCount(data.expense || 0);
      setIncomeCount(data.income || 0);
      setTransferCount(data.transfer || 0);
    } catch (error) {
      console.error("Error loading counts:", error);
    }
  }, []);

  const loadPlannedPayments = useCallback(async () => {
    // Cancel any previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      setLoading(true);
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const horizonDate = new Date(today);
      horizonDate.setDate(horizonDate.getDate() + PLANNED_HORIZON_DAYS);
      
      const params = new URLSearchParams();
      params.append("startDate", today.toISOString().split('T')[0]);
      params.append("endDate", horizonDate.toISOString().split('T')[0]);
      params.append("status", "scheduled");
      params.append("type", activeTab);
      
      // Add pagination parameters
      const limit = isMobile ? 10 : itemsPerPage;
      params.append("page", currentPage.toString());
      params.append("limit", limit.toString());
      
      // Use v2 API
      const url = `/api/v2/planned-payments?${params.toString()}&_t=${Date.now()}`;
      
      const response = await fetch(url, {
        cache: 'no-store',
        signal: abortController.signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.message || "Failed to fetch planned payments");
      }

      if (abortController.signal.aborted) {
        return;
      }

      const data = await response.json();
      
      const newPayments: PlannedPayment[] = data.plannedPayments || [];
      const total = data.total || 0;
      
      setTotalPayments(total);
      
      // For mobile infinite scroll: accumulate payments
      // For desktop: replace payments (normal pagination)
      if (currentPage === 1) {
        setPayments(newPayments);
        setAllPayments(newPayments);
      } else {
        setPayments(newPayments);
        setAllPayments(prev => {
          const existingIds = new Set(prev.map(p => p.id));
          const uniqueNew = newPayments.filter(p => !existingIds.has(p.id));
          return [...prev, ...uniqueNew];
        });
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return;
      }
      console.error("Error loading planned payments:", error);
      toast({
        title: "Error loading planned payments",
        description: error instanceof Error ? error.message : "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      if (!abortController.signal.aborted) {
        setLoading(false);
      }
      if (abortControllerRef.current === abortController) {
        abortControllerRef.current = null;
      }
    }
  }, [activeTab, currentPage, itemsPerPage, isMobile, toast]);

  // Sync planned payments on mount (only once per session)
  useEffect(() => {
    const hasSynced = sessionStorage.getItem("planned-payments-synced");
    if (!hasSynced) {
      syncPlannedPayments();
      sessionStorage.setItem("planned-payments-synced", "true");
    }
  }, [syncPlannedPayments]);

  // Load initial data and counts
  useEffect(() => {
    loadCounts();
    loadPlannedPayments();
  }, [loadCounts, loadPlannedPayments]);

  // Reset to page 1 when tab changes
  useEffect(() => {
    setCurrentPage(1);
    setAllPayments([]);
    loadPlannedPayments();
    // Note: We don't reload counts when tab changes because counts are totals for all types
  }, [activeTab, loadPlannedPayments]);

  // Reset loadingMore when payments are loaded
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

  // Load payments when page changes
  useEffect(() => {
    if (currentPage > 1) {
      loadPlannedPayments();
    }
  }, [currentPage, loadPlannedPayments]);

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
        setAllPayments([]);
        setTimeout(() => {
          Promise.all([loadCounts(), loadPlannedPayments()]).finally(() => {
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
  }, [pullDistance, loading, isRefreshing, loadCounts, loadPlannedPayments]);

  const handleMarkAsPaid = async (payment: PlannedPayment) => {
    if (processingIds.has(payment.id)) return;
    
    setProcessingIds((prev) => new Set(prev).add(payment.id));
    try {
      const response = await fetch(`/api/v2/planned-payments/${payment.id}/mark-paid`, {
        method: "POST",
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to mark payment as paid");
      }
      
      // Reload payments to reflect changes
      setCurrentPage(1);
      setAllPayments([]);
      await Promise.all([loadCounts(), loadPlannedPayments()]);
      toast({
        title: "Payment marked as paid",
        description: "Transaction has been created successfully.",
        variant: "success",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to mark payment as paid",
        variant: "destructive",
      });
    } finally {
      setProcessingIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(payment.id);
        return newSet;
      });
    }
  };

  const handleSkip = async (payment: PlannedPayment) => {
    if (processingIds.has(payment.id)) return;
    
    setProcessingIds((prev) => new Set(prev).add(payment.id));
    try {
      const response = await fetch(`/api/v2/planned-payments/${payment.id}/skip`, {
        method: "POST",
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to skip payment");
      }
      
      // Reload payments to reflect changes
      setCurrentPage(1);
      setAllPayments([]);
      await Promise.all([loadCounts(), loadPlannedPayments()]);
      toast({
        title: "Payment skipped",
        description: "This payment has been skipped.",
        variant: "success",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to skip payment",
        variant: "destructive",
      });
    } finally {
      setProcessingIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(payment.id);
        return newSet;
      });
    }
  };

  const handleCancel = async (payment: PlannedPayment) => {
    if (processingIds.has(payment.id)) return;
    
    setProcessingIds((prev) => new Set(prev).add(payment.id));
    try {
      const response = await fetch(`/api/v2/planned-payments/${payment.id}/cancel`, {
        method: "POST",
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to cancel payment");
      }
      
      // Reload payments to reflect changes
      setCurrentPage(1);
      setAllPayments([]);
      await Promise.all([loadCounts(), loadPlannedPayments()]);
      toast({
        title: "Payment cancelled",
        description: "This payment has been cancelled.",
        variant: "success",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to cancel payment",
        variant: "destructive",
      });
    } finally {
      setProcessingIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(payment.id);
        return newSet;
      });
    }
  };

  const getDaysUntil = (date: string | Date) => {
    const dueDate = date instanceof Date ? date : new Date(date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    dueDate.setHours(0, 0, 0, 0);
    return differenceInDays(dueDate, today);
  };

  const formatDateLabel = (date: string | Date) => {
    const dueDate = date instanceof Date ? date : new Date(date);
    const daysUntil = getDaysUntil(dueDate);

    if (isToday(dueDate)) {
      return "Today";
    } else if (isTomorrow(dueDate)) {
      return "Tomorrow";
    } else if (daysUntil <= 7) {
      // Return day name in English
      const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
      return dayNames[dueDate.getDay()];
    } else {
      return format(dueDate, "MM/dd/yyyy");
    }
  };

  const getUrgencyColor = (daysUntil: number) => {
    if (daysUntil < 0) return "text-red-600 dark:text-red-400";
    if (daysUntil === 0) return "text-orange-600 dark:text-orange-400";
    if (daysUntil <= 3) return "text-yellow-600 dark:text-yellow-400";
    return "text-muted-foreground";
  };

  const getCategoryName = (payment: PlannedPayment) => {
    return (
      payment.subcategory?.name ||
      payment.category?.name ||
      payment.description ||
      "Payment"
    );
  };

  const getAccountName = (payment: PlannedPayment) => {
    return payment.account?.name || "Account not specified";
  };

  const getToAccountName = (payment: PlannedPayment) => {
    return payment.toAccount?.name || "-";
  };


  // Set default tab to first available tab with items on initial load only
  useEffect(() => {
    if (!loading && expenseCount === 0 && incomeCount === 0 && transferCount === 0) {
      return; // Don't change tab if no payments at all
    }
    if (!loading && activeTab === "expense" && expenseCount === 0) {
      // Only set initial tab if expense is empty and we're still on the default tab
      if (incomeCount > 0) {
        setActiveTab("income");
      } else if (transferCount > 0) {
        setActiveTab("transfer");
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, expenseCount, incomeCount, transferCount]);

  return (
    <SimpleTabs value={activeTab} onValueChange={(value) => setActiveTab(value as typeof activeTab)} className="w-full">
      <PageHeader
        title="Planned Payment"
      />

      {/* Fixed Tabs - Desktop only */}
      <FixedTabsWrapper>
        <SimpleTabsList>
          <SimpleTabsTrigger value="expense">
            Expense {expenseCount > 0 && `(${expenseCount})`}
          </SimpleTabsTrigger>
          <SimpleTabsTrigger value="income">
            Income {incomeCount > 0 && `(${incomeCount})`}
          </SimpleTabsTrigger>
          <SimpleTabsTrigger value="transfer">
            Transfer {transferCount > 0 && `(${transferCount})`}
          </SimpleTabsTrigger>
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
              Expense {expenseCount > 0 && `(${expenseCount})`}
            </SimpleTabsTrigger>
            <SimpleTabsTrigger value="income" className="flex-shrink-0 whitespace-nowrap">
              Income {incomeCount > 0 && `(${incomeCount})`}
            </SimpleTabsTrigger>
            <SimpleTabsTrigger value="transfer" className="flex-shrink-0 whitespace-nowrap">
              Transfer {transferCount > 0 && `(${transferCount})`}
            </SimpleTabsTrigger>
          </SimpleTabsList>
        </div>
      </div>

      <div className="w-full p-4 lg:p-8">
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
          
          {loading && currentPage === 1 && !isRefreshing ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading planned payments...
            </div>
          ) : mobilePayments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No {activeTab} payments found
            </div>
          ) : (
            <>
              {mobilePayments.map((payment, index) => {
                  const daysUntil = getDaysUntil(payment.date);
                  const amount = Math.abs(payment.amount || 0);
                  const dateLabel = formatDateLabel(payment.date);
                  const isProcessing = processingIds.has(payment.id);
                  
                  return (
                    <div key={payment.id || index} className="mb-4 p-4 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span className={cn("font-medium text-sm", getUrgencyColor(daysUntil))}>
                            {dateLabel}
                          </span>
                        </div>
                        <div className={cn("font-bold text-sm", 
                          payment.type === "expense" ? "text-red-600 dark:text-red-400" :
                          payment.type === "income" ? "text-green-600 dark:text-green-400" :
                          ""
                        )}>
                          {payment.type === "expense" ? "-" : payment.type === "income" ? "+" : ""}
                          {formatMoney(amount)}
                        </div>
                      </div>
                      <div className="text-sm font-medium mb-1">{getCategoryName(payment)}</div>
                      {payment.description && (
                        <div className="text-xs text-muted-foreground mb-2 truncate">
                          {payment.description}
                        </div>
                      )}
                      <div className="flex items-center justify-between">
                        <div className="text-xs text-muted-foreground">
                          {getAccountName(payment)}
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              disabled={isProcessing}
                            >
                              {isProcessing ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <MoreVertical className="h-4 w-4" />
                              )}
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => handleMarkAsPaid(payment)}
                              disabled={isProcessing}
                            >
                              <Check className="h-4 w-4 mr-2" />
                              Mark as Paid
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleSkip(payment)}
                              disabled={isProcessing}
                            >
                              <SkipForward className="h-4 w-4 mr-2" />
                              Skip
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleCancel(payment)}
                              disabled={isProcessing}
                              className="text-destructive"
                            >
                              <X className="h-4 w-4 mr-2" />
                              Cancel
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
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
        <div className="hidden lg:block">
        <SimpleTabsContent value="expense">
          {loading && currentPage === 1 ? (
            <div className="rounded-lg p-12">
              <div className="text-center">
                <p className="text-sm text-muted-foreground">
                  Loading planned payments...
                </p>
              </div>
            </div>
          ) : expensePayments.length === 0 ? (
            <div className="rounded-lg p-12">
              <div className="text-center">
                <p className="text-sm text-muted-foreground">
                  No future expenses found
                </p>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs md:text-sm">Date</TableHead>
                    <TableHead className="text-xs md:text-sm">Description</TableHead>
                    <TableHead className="text-xs md:text-sm hidden md:table-cell">Category</TableHead>
                    <TableHead className="text-xs md:text-sm hidden lg:table-cell">Account</TableHead>
                    <TableHead className="text-xs md:text-sm hidden lg:table-cell">Source</TableHead>
                    <TableHead className="text-right text-xs md:text-sm">Amount</TableHead>
                    <TableHead className="text-xs md:text-sm">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expensePayments.map((payment, index) => {
                    const daysUntil = getDaysUntil(payment.date);
                    const amount = Math.abs(payment.amount || 0);
                    const dateLabel = formatDateLabel(payment.date);
                    const isProcessing = processingIds.has(payment.id);

                    return (
                      <TableRow key={payment.id || index} className="hover:bg-muted/50">
                        <TableCell className="text-xs md:text-sm">
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            <span className={cn("font-medium", getUrgencyColor(daysUntil))}>
                              {dateLabel}
                            </span>
                          </div>
                          <div className="text-xs text-muted-foreground mt-1 md:hidden">
                            {daysUntil >= 0
                              ? daysUntil === 0
                                ? "Today"
                                : daysUntil === 1
                                ? "1 day"
                                : `${daysUntil} days`
                              : "Overdue"}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs md:text-sm">
                          <div className="font-medium">{getCategoryName(payment)}</div>
                          {payment.description && (
                            <div className="text-xs text-muted-foreground mt-1 truncate max-w-[200px]">
                              {payment.description}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-xs md:text-sm hidden md:table-cell">
                          {payment.subcategory?.name || payment.category?.name || "-"}
                        </TableCell>
                        <TableCell className="text-xs md:text-sm hidden lg:table-cell">
                          {getAccountName(payment)}
                        </TableCell>
                        <TableCell className="text-xs md:text-sm hidden lg:table-cell">
                          {payment.source === "debt" && (
                            <span className="text-xs px-2 py-1 rounded bg-interactive-primary/10 text-interactive-primary">
                              Debt
                            </span>
                          )}
                          {payment.source === "recurring" && (
                            <span className="text-xs px-2 py-1 rounded bg-interactive-primary/10 text-interactive-primary">
                              Recurring
                            </span>
                          )}
                          {payment.source === "subscription" && (
                            <span className="text-xs px-2 py-1 rounded bg-sentiment-positive/10 text-sentiment-positive">
                              Subscription
                            </span>
                          )}
                          {payment.source === "manual" && (
                            <span className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200">
                              Manual
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right text-xs md:text-sm">
                          <div className="font-bold tabular-nums text-red-600 dark:text-red-400">
                            -{formatMoney(amount)}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1 hidden md:block">
                            {daysUntil >= 0
                              ? daysUntil === 0
                                ? "Today"
                                : daysUntil === 1
                                ? "1 day"
                                : `${daysUntil} days`
                              : "Overdue"}
                          </div>
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                disabled={isProcessing}
                              >
                                {isProcessing ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <MoreVertical className="h-4 w-4" />
                                )}
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => handleMarkAsPaid(payment)}
                                disabled={isProcessing}
                              >
                                <Check className="h-4 w-4 mr-2" />
                                Mark as Paid
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleSkip(payment)}
                                disabled={isProcessing}
                              >
                                <SkipForward className="h-4 w-4 mr-2" />
                                Skip
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleCancel(payment)}
                                disabled={isProcessing}
                                className="text-destructive"
                              >
                                <X className="h-4 w-4 mr-2" />
                                Cancel
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </SimpleTabsContent>

        <SimpleTabsContent value="income">
          {incomePayments.length === 0 ? (
            <div className="rounded-lg p-12">
              <div className="text-center">
                <p className="text-sm text-muted-foreground">
                  No future income found
                </p>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs md:text-sm">Date</TableHead>
                    <TableHead className="text-xs md:text-sm">Description</TableHead>
                    <TableHead className="text-xs md:text-sm hidden md:table-cell">Category</TableHead>
                    <TableHead className="text-xs md:text-sm hidden lg:table-cell">Account</TableHead>
                    <TableHead className="text-xs md:text-sm hidden lg:table-cell">Source</TableHead>
                    <TableHead className="text-right text-xs md:text-sm">Amount</TableHead>
                    <TableHead className="text-xs md:text-sm">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {incomePayments.map((payment, index) => {
                    const daysUntil = getDaysUntil(payment.date);
                    const amount = Math.abs(payment.amount || 0);
                    const dateLabel = formatDateLabel(payment.date);
                    const isProcessing = processingIds.has(payment.id);

                    return (
                      <TableRow key={payment.id || index} className="hover:bg-muted/50">
                        <TableCell className="text-xs md:text-sm">
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            <span className={cn("font-medium", getUrgencyColor(daysUntil))}>
                              {dateLabel}
                            </span>
                          </div>
                          <div className="text-xs text-muted-foreground mt-1 md:hidden">
                            {daysUntil >= 0
                              ? daysUntil === 0
                                ? "Today"
                                : daysUntil === 1
                                ? "1 day"
                                : `${daysUntil} days`
                              : "Overdue"}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs md:text-sm">
                          <div className="font-medium">{getCategoryName(payment)}</div>
                          {payment.description && (
                            <div className="text-xs text-muted-foreground mt-1 truncate max-w-[200px]">
                              {payment.description}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-xs md:text-sm hidden md:table-cell">
                          {payment.subcategory?.name || payment.category?.name || "-"}
                        </TableCell>
                        <TableCell className="text-xs md:text-sm hidden lg:table-cell">
                          {getAccountName(payment)}
                        </TableCell>
                        <TableCell className="text-xs md:text-sm hidden lg:table-cell">
                          {payment.source === "recurring" && (
                            <span className="text-xs px-2 py-1 rounded bg-interactive-primary/10 text-interactive-primary">
                              Recurring
                            </span>
                          )}
                          {payment.source === "subscription" && (
                            <span className="text-xs px-2 py-1 rounded bg-sentiment-positive/10 text-sentiment-positive">
                              Subscription
                            </span>
                          )}
                          {payment.source === "manual" && (
                            <span className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200">
                              Manual
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right text-xs md:text-sm">
                          <div className="font-bold tabular-nums text-green-600 dark:text-green-400">
                            +{formatMoney(amount)}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1 hidden md:block">
                            {daysUntil >= 0
                              ? daysUntil === 0
                                ? "Today"
                                : daysUntil === 1
                                ? "1 day"
                                : `${daysUntil} days`
                              : "Overdue"}
                          </div>
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                disabled={isProcessing}
                              >
                                {isProcessing ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <MoreVertical className="h-4 w-4" />
                                )}
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => handleMarkAsPaid(payment)}
                                disabled={isProcessing}
                              >
                                <Check className="h-4 w-4 mr-2" />
                                Mark as Paid
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleSkip(payment)}
                                disabled={isProcessing}
                              >
                                <SkipForward className="h-4 w-4 mr-2" />
                                Skip
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleCancel(payment)}
                                disabled={isProcessing}
                                className="text-destructive"
                              >
                                <X className="h-4 w-4 mr-2" />
                                Cancel
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </SimpleTabsContent>

      <SimpleTabsContent value="transfer">
        {transferPayments.length === 0 ? (
            <div className="rounded-lg p-12">
              <div className="text-center">
                <p className="text-sm text-muted-foreground">
                  No future transfers found
                </p>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs md:text-sm">Date</TableHead>
                    <TableHead className="text-xs md:text-sm">Description</TableHead>
                    <TableHead className="text-xs md:text-sm hidden md:table-cell">From Account</TableHead>
                    <TableHead className="text-xs md:text-sm hidden md:table-cell">To Account</TableHead>
                    <TableHead className="text-xs md:text-sm hidden lg:table-cell">Source</TableHead>
                    <TableHead className="text-right text-xs md:text-sm">Amount</TableHead>
                    <TableHead className="text-xs md:text-sm">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transferPayments.map((payment, index) => {
                    const daysUntil = getDaysUntil(payment.date);
                    const amount = Math.abs(payment.amount || 0);
                    const dateLabel = formatDateLabel(payment.date);
                    const isProcessing = processingIds.has(payment.id);

                    return (
                      <TableRow key={payment.id || index} className="hover:bg-muted/50">
                        <TableCell className="text-xs md:text-sm">
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            <span className={cn("font-medium", getUrgencyColor(daysUntil))}>
                              {dateLabel}
                            </span>
                          </div>
                          <div className="text-xs text-muted-foreground mt-1 md:hidden">
                            {daysUntil >= 0
                              ? daysUntil === 0
                                ? "Today"
                                : daysUntil === 1
                                ? "1 day"
                                : `${daysUntil} days`
                              : "Overdue"}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs md:text-sm">
                          <div className="font-medium">{getCategoryName(payment)}</div>
                          {payment.description && (
                            <div className="text-xs text-muted-foreground mt-1 truncate max-w-[200px]">
                              {payment.description}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-xs md:text-sm hidden md:table-cell">
                          {getAccountName(payment)}
                        </TableCell>
                        <TableCell className="text-xs md:text-sm hidden md:table-cell">
                          <div className="flex items-center gap-2">
                            <ArrowRight className="h-4 w-4 text-muted-foreground" />
                            {getToAccountName(payment)}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs md:text-sm hidden lg:table-cell">
                          {payment.source === "recurring" && (
                            <span className="text-xs px-2 py-1 rounded bg-interactive-primary/10 text-interactive-primary">
                              Recurring
                            </span>
                          )}
                          {payment.source === "subscription" && (
                            <span className="text-xs px-2 py-1 rounded bg-sentiment-positive/10 text-sentiment-positive">
                              Subscription
                            </span>
                          )}
                          {payment.source === "manual" && (
                            <span className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200">
                              Manual
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right text-xs md:text-sm">
                          <div className="font-bold tabular-nums">
                            {formatMoney(amount)}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1 hidden md:block">
                            {daysUntil >= 0
                              ? daysUntil === 0
                                ? "Today"
                                : daysUntil === 1
                                ? "1 day"
                                : `${daysUntil} days`
                              : "Overdue"}
                          </div>
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                disabled={isProcessing}
                              >
                                {isProcessing ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <MoreVertical className="h-4 w-4" />
                                )}
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => handleMarkAsPaid(payment)}
                                disabled={isProcessing}
                              >
                                <Check className="h-4 w-4 mr-2" />
                                Mark as Paid
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleSkip(payment)}
                                disabled={isProcessing}
                              >
                                <SkipForward className="h-4 w-4 mr-2" />
                                Skip
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleCancel(payment)}
                                disabled={isProcessing}
                                className="text-destructive"
                              >
                                <X className="h-4 w-4 mr-2" />
                                Cancel
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </SimpleTabsContent>
        </div>

        {/* Pagination Controls - Desktop only */}
        {payments.length > 0 && (
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
                Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, totalPayments)} of {totalPayments} payments
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="small"
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
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
                      onClick={() => setCurrentPage(pageNum)}
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
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
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

      {/* Transaction Form for creating planned payments */}
      <TransactionForm
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        onSuccess={() => {
          loadCounts();
          loadPlannedPayments();
        }}
        defaultType={activeTab}
      />

      {/* Mobile Floating Action Button */}
      <div className="fixed bottom-20 right-4 z-[60] lg:hidden">
        <Button
          size="large"
          className="h-14 w-14 rounded-full shadow-lg"
          onClick={() => setIsFormOpen(true)}
        >
          <Plus className="h-6 w-6" />
        </Button>
      </div>
    </SimpleTabs>
  );
}

