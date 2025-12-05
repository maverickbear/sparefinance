"use client";

import { useMemo, useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import dynamic from "next/dynamic";
import { RefreshCw, Loader2, ChevronDown } from "lucide-react";
import { ChartSkeleton } from "@/components/ui/chart-skeleton";
import { CardSkeleton } from "@/components/ui/card-skeleton";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SummaryCards } from "./summary-cards";
import { FinancialHealthScoreWidget } from "./widgets/financial-health-score-widget";
import { calculateTotalIncome, calculateTotalExpenses } from "./utils/transaction-helpers";
// Using API route instead of client-side API
import type { HouseholdMember } from "@/src/domain/members/members.types";
import { calculateLastMonthBalanceFromCurrent } from "@/lib/services/balance-calculator";

// Lazy load widgets with heavy chart libraries (recharts) - no SSR
const CashFlowTimelineWidget = dynamic(
  () => import("./widgets/cash-flow-timeline-widget").then(m => ({ default: m.CashFlowTimelineWidget })),
  { 
    ssr: false, // recharts doesn't work well with SSR
    loading: () => <ChartSkeleton height={400} />
  }
);

// Lazy load widgets below the fold - with SSR
const ExpensesByCategoryWidget = dynamic(
  () => import("./widgets/expenses-by-category-widget").then(m => ({ default: m.ExpensesByCategoryWidget })),
  { 
    ssr: true,
    loading: () => <CardSkeleton />
  }
);


const BudgetStatusWidget = dynamic(
  () => import("./widgets/budget-status-widget").then(m => ({ default: m.BudgetStatusWidget })),
  { 
    ssr: true,
    loading: () => <CardSkeleton />
  }
);

const SavingsGoalsWidget = dynamic(
  () => import("./widgets/savings-goals-widget").then(m => ({ default: m.SavingsGoalsWidget })),
  { 
    ssr: true,
    loading: () => <CardSkeleton />
  }
);

const NetWorthWidget = dynamic(
  () => import("./widgets/net-worth-widget").then(m => ({ default: m.NetWorthWidget })),
  { 
    ssr: false, // recharts doesn't work well with SSR
    loading: () => <ChartSkeleton height={300} />
  }
);

const PortfolioPerformanceWidget = dynamic(
  () => import("./widgets/portfolio-performance-widget").then(m => ({ default: m.PortfolioPerformanceWidget })),
  { 
    ssr: false, // recharts doesn't work well with SSR
    loading: () => <CardSkeleton />
  }
);

const InvestmentPortfolioWidget = dynamic(
  () => import("./widgets/investment-portfolio-widget").then(m => ({ default: m.InvestmentPortfolioWidget })),
  { 
    ssr: false, // recharts doesn't work well with SSR
    loading: () => <CardSkeleton />
  }
);

const RecurringPaymentsWidget = dynamic(
  () => import("./widgets/recurring-payments-widget").then(m => ({ default: m.RecurringPaymentsWidget })),
  { 
    ssr: true,
    loading: () => <CardSkeleton />
  }
);

const SubscriptionsWidget = dynamic(
  () => import("./widgets/subscriptions-widget").then(m => ({ default: m.SubscriptionsWidget })),
  { 
    ssr: true,
    loading: () => <CardSkeleton />
  }
);

interface FinancialOverviewPageProps {
  selectedMonthTransactions: any[];
  lastMonthTransactions: any[];
  savings: number;
  totalBalance: number;
  lastMonthTotalBalance: number;
  accounts: any[];
  budgets: any[];
  upcomingTransactions: any[];
  financialHealth: any;
  goals: any[];
  chartTransactions: any[];
  liabilities: any[];
  debts: any[];
  recurringPayments: any[];
  subscriptions: any[];
  selectedMonthDate: Date;
  expectedIncomeRange?: string | null;
}

export function FinancialOverviewPage({
  selectedMonthTransactions: initialSelectedMonthTransactions,
  lastMonthTransactions: initialLastMonthTransactions,
  savings: initialSavings,
  totalBalance: initialTotalBalance,
  lastMonthTotalBalance: initialLastMonthTotalBalance,
  accounts: initialAccounts,
  budgets: initialBudgets,
  upcomingTransactions: initialUpcomingTransactions,
  financialHealth: initialFinancialHealth,
  goals: initialGoals,
  chartTransactions: initialChartTransactions,
  liabilities: initialLiabilities,
  debts: initialDebts,
  recurringPayments: initialRecurringPayments,
  subscriptions: initialSubscriptions,
  selectedMonthDate,
  expectedIncomeRange: initialExpectedIncomeRange,
}: FinancialOverviewPageProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [householdMembers, setHouseholdMembers] = useState<HouseholdMember[]>([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(true);

  // Local state for dashboard data - initialized from props and updated on refresh
  const [selectedMonthTransactions, setSelectedMonthTransactions] = useState(initialSelectedMonthTransactions);
  const [lastMonthTransactions, setLastMonthTransactions] = useState(initialLastMonthTransactions);
  const [savings, setSavings] = useState(initialSavings);
  const [totalBalance, setTotalBalance] = useState(initialTotalBalance);
  const [lastMonthTotalBalance, setLastMonthTotalBalance] = useState(initialLastMonthTotalBalance);
  const [accounts, setAccounts] = useState(initialAccounts);
  const [budgets, setBudgets] = useState(initialBudgets);
  const [upcomingTransactions, setUpcomingTransactions] = useState(initialUpcomingTransactions);
  const [financialHealth, setFinancialHealth] = useState(initialFinancialHealth);
  const [goals, setGoals] = useState(initialGoals);
  const [chartTransactions, setChartTransactions] = useState(initialChartTransactions);
  const [liabilities, setLiabilities] = useState(initialLiabilities);
  const [debts, setDebts] = useState(initialDebts);
  const [recurringPayments, setRecurringPayments] = useState(initialRecurringPayments);
  const [subscriptions, setSubscriptions] = useState(initialSubscriptions);
  const [expectedIncomeRange, setExpectedIncomeRange] = useState(initialExpectedIncomeRange);

  // Update local state when props change (e.g., when range changes)
  useEffect(() => {
    setSelectedMonthTransactions(initialSelectedMonthTransactions);
    setLastMonthTransactions(initialLastMonthTransactions);
    setSavings(initialSavings);
    setTotalBalance(initialTotalBalance);
    setLastMonthTotalBalance(initialLastMonthTotalBalance);
    setAccounts(initialAccounts);
    setBudgets(initialBudgets);
    setUpcomingTransactions(initialUpcomingTransactions);
    setFinancialHealth(initialFinancialHealth);
    setGoals(initialGoals);
    setChartTransactions(initialChartTransactions);
    setLiabilities(initialLiabilities);
    setDebts(initialDebts);
    setRecurringPayments(initialRecurringPayments);
    setSubscriptions(initialSubscriptions);
    setExpectedIncomeRange(initialExpectedIncomeRange);
  }, [
    initialSelectedMonthTransactions,
    initialLastMonthTransactions,
    initialSavings,
    initialTotalBalance,
    initialLastMonthTotalBalance,
    initialAccounts,
    initialBudgets,
    initialUpcomingTransactions,
    initialFinancialHealth,
    initialGoals,
    initialChartTransactions,
    initialLiabilities,
    initialDebts,
    initialRecurringPayments,
    initialSubscriptions,
    initialExpectedIncomeRange,
  ]);

  // Get selected range from URL or default to "this-month"
  type DateRange = "this-month" | "last-month" | "last-60-days" | "last-90-days";
  const rangeParam = searchParams.get("range") as DateRange | null;
  const selectedRange: DateRange = rangeParam && ["this-month", "last-month", "last-60-days", "last-90-days"].includes(rangeParam)
    ? rangeParam
    : "this-month";

  const handleRangeChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    
    if (value === "this-month") {
      // Remove range param to default to this month
      params.delete("range");
      params.delete("month"); // Also remove old month param if present
    } else {
      params.set("range", value);
      params.delete("month"); // Remove old month param
    }
    
    const queryString = params.toString();
    router.push(queryString ? `${pathname}?${queryString}` : pathname);
    router.refresh();
  };

  const getOverviewTitle = (range: DateRange): { variable: string; overview: string } => {
    switch (range) {
      case "this-month":
        return { variable: "This month", overview: "overview" };
      case "last-month":
        return { variable: "Last month", overview: "overview" };
      case "last-60-days":
        return { variable: "Last 60 days", overview: "overview" };
      case "last-90-days":
        return { variable: "Last 90 days", overview: "overview" };
      default:
        return { variable: "This month", overview: "overview" };
    }
  };

  // Load household members
  useEffect(() => {
    async function loadMembers() {
      try {
        const response = await fetch("/api/v2/members");
        if (!response.ok) {
          throw new Error("Failed to fetch members");
        }
        const { members } = await response.json();
        setHouseholdMembers(members);
        setIsLoadingMembers(false);
      } catch (error) {
        console.error("Error loading household members:", error);
        setIsLoadingMembers(false);
      }
    }
    
    loadMembers();
  }, []);

  // Update current time every minute to refresh relative time display
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000); // Update every minute

    return () => clearInterval(interval);
  }, []);

  // Filter accounts by selected household member
  const filteredAccounts = useMemo(() => {
    if (!selectedMemberId) {
      return accounts; // Show all household accounts
    }
    // Filter accounts that belong to the selected member
    // An account belongs to a member if:
    // 1. The account's userId matches the selectedMemberId, OR
    // 2. The account has the selectedMemberId in its ownerIds array
    return accounts.filter((acc: any) => {
      // Use String() to ensure type consistency in comparison
      if (String(acc.userId) === String(selectedMemberId)) {
        return true;
      }
      if (acc.ownerIds && Array.isArray(acc.ownerIds)) {
        return acc.ownerIds.some((id: any) => String(id) === String(selectedMemberId));
      }
      return false;
    });
  }, [accounts, selectedMemberId]);

  // Recalculate totalBalance and savings based on filtered accounts
  const filteredTotalBalance = useMemo(() => {
    return filteredAccounts.reduce((sum: number, acc: any) => sum + (acc.balance || 0), 0);
  }, [filteredAccounts]);

  const filteredSavings = useMemo(() => {
    return filteredAccounts
      .filter((acc: any) => acc.type === 'savings')
      .reduce((sum: number, acc: any) => sum + (acc.balance || 0), 0);
  }, [filteredAccounts]);

  // Filter transactions by selected household member
  const filterTransactionsByMember = useCallback((transactions: any[]) => {
    if (!selectedMemberId) {
      return transactions; // Show all household transactions
    }
    return transactions.filter((t) => {
      // Use String() to ensure type consistency in comparison
      return String(t.userId) === String(selectedMemberId);
    });
  }, [selectedMemberId]);

  // Function to format relative time
  const relativeTimeText = useMemo(() => {
    const now = currentTime;
    const diffInSeconds = Math.floor((now.getTime() - lastUpdated.getTime()) / 1000);
    
    // Less than 1 minute
    if (diffInSeconds < 60) {
      return "Just Now";
    }
    
    // Less than 1 hour
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) {
      return `${diffInMinutes}m ago`;
    }
    
    // Less than 1 day
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) {
      return `${diffInHours}h ago`;
    }
    
    // Less than 1 week
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) {
      return `${diffInDays}d ago`;
    }
    
    // Less than 1 month (approximately 4 weeks)
    const diffInWeeks = Math.floor(diffInDays / 7);
    if (diffInWeeks < 4) {
      return `${diffInWeeks}w ago`;
    }
    
    // Less than 1 year
    const diffInMonths = Math.floor(diffInDays / 30);
    if (diffInMonths < 12) {
      return `${diffInMonths}m ago`;
    }
    
    // More than 1 year
    const diffInYears = Math.floor(diffInDays / 365);
    return `${diffInYears}y ago`;
  }, [lastUpdated, currentTime]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      // Build API URL with current range
      const params = new URLSearchParams();
      if (selectedRange !== "this-month") {
        params.set("range", selectedRange);
      }
      const url = `/api/v2/dashboard${params.toString() ? `?${params.toString()}` : ""}`;
      
      // Fetch updated dashboard data
      const response = await fetch(url, {
        method: "GET",
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error("Failed to refresh dashboard data");
      }

      const data = await response.json();

      // Update local state with new data (cards remain visible, only numbers update)
      setSelectedMonthTransactions(data.selectedMonthTransactions || []);
      setLastMonthTransactions(data.lastMonthTransactions || []);
      setSavings(data.savings || 0);
      setTotalBalance(data.totalBalance || 0);
      setLastMonthTotalBalance(data.lastMonthTotalBalance || 0);
      setAccounts(data.accounts || []);
      setBudgets(data.budgets || []);
      setUpcomingTransactions(data.upcomingTransactions || []);
      setFinancialHealth(data.financialHealth || initialFinancialHealth);
      setGoals(data.goals || []);
      setChartTransactions(data.chartTransactions || []);
      setLiabilities(data.liabilities || []);
      setDebts(data.debts || []);
      setRecurringPayments(data.recurringPayments || []);
      setSubscriptions(data.subscriptions || []);
      setExpectedIncomeRange(data.expectedIncomeRange || null);
      
      setLastUpdated(new Date());
    } catch (error) {
      console.error("Error refreshing dashboard:", error);
      // Optionally show a toast notification here
    } finally {
      setIsRefreshing(false);
    }
  };
  // Helper function to parse date from Supabase format
  const parseTransactionDate = (dateStr: string | Date): Date => {
    if (dateStr instanceof Date) {
      return dateStr;
    }
    // Handle both "YYYY-MM-DD HH:MM:SS" and "YYYY-MM-DDTHH:MM:SS" formats
    const normalized = dateStr.replace(' ', 'T').split('.')[0]; // Remove milliseconds if present
    return new Date(normalized);
  };

  // Get today's date (without time) to filter out future transactions
  const today = useMemo(() => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    return date;
  }, []);

  // Filter transactions by household member and date
  const pastSelectedMonthTransactions = useMemo(() => {
    const memberFiltered = filterTransactionsByMember(selectedMonthTransactions);
    return memberFiltered.filter((t) => {
      if (!t.date) return false;
      try {
        const txDate = parseTransactionDate(t.date);
        txDate.setHours(0, 0, 0, 0);
        return txDate <= today;
      } catch (error) {
        return false; // Exclude if date parsing fails
      }
    });
  }, [selectedMonthTransactions, today, filterTransactionsByMember]);

  const pastLastMonthTransactions = useMemo(() => {
    const memberFiltered = filterTransactionsByMember(lastMonthTransactions);
    return memberFiltered.filter((t) => {
      if (!t.date) return false;
      try {
        const txDate = parseTransactionDate(t.date);
        txDate.setHours(0, 0, 0, 0);
        return txDate <= today;
      } catch (error) {
        return false; // Exclude if date parsing fails
      }
    });
  }, [lastMonthTransactions, today, filterTransactionsByMember]);

  // Recalculate lastMonthTotalBalance based on filtered accounts and transactions
  const filteredLastMonthTotalBalance = useMemo(() => {
    return calculateLastMonthBalanceFromCurrent(
      filteredTotalBalance,
      pastSelectedMonthTransactions
    );
  }, [filteredTotalBalance, pastSelectedMonthTransactions]);

  // Filter chart transactions by household member
  const filteredChartTransactions = useMemo(() => {
    return filterTransactionsByMember(chartTransactions);
  }, [chartTransactions, filterTransactionsByMember]);

  // Filter other data by household member
  const filteredBudgets = useMemo(() => {
    if (!selectedMemberId) {
      return budgets;
    }
    return budgets.filter((b: any) => b.userId === selectedMemberId);
  }, [budgets, selectedMemberId]);

  const filteredGoals = useMemo(() => {
    if (!selectedMemberId) {
      return goals;
    }
    return goals.filter((g: any) => g.userId === selectedMemberId);
  }, [goals, selectedMemberId]);

  const filteredRecurringPayments = useMemo(() => {
    if (!selectedMemberId) {
      return recurringPayments;
    }
    return recurringPayments.filter((rp: any) => rp.userId === selectedMemberId);
  }, [recurringPayments, selectedMemberId]);

  const filteredSubscriptions = useMemo(() => {
    if (!selectedMemberId) {
      return subscriptions;
    }
    return subscriptions.filter((s: any) => s.userId === selectedMemberId);
  }, [subscriptions, selectedMemberId]);

  const filteredDebts = useMemo(() => {
    if (!selectedMemberId) {
      return debts;
    }
    return debts.filter((d: any) => d.userId === selectedMemberId);
  }, [debts, selectedMemberId]);

  const filteredLiabilities = useMemo(() => {
    if (!selectedMemberId) {
      return liabilities;
    }
    // Filter liabilities by account ownership
    const filteredAccountIds = new Set(filteredAccounts.map((acc: any) => acc.id));
    return liabilities.filter((l: any) => filteredAccountIds.has(l.accountId));
  }, [liabilities, selectedMemberId, filteredAccounts]);

  // Calculate income and expenses using helper functions for consistency
  // Only include past transactions (exclude future ones)
  const currentIncome = useMemo(() => {
    return calculateTotalIncome(pastSelectedMonthTransactions);
  }, [pastSelectedMonthTransactions]);

  const currentExpenses = useMemo(() => {
    return calculateTotalExpenses(pastSelectedMonthTransactions);
  }, [pastSelectedMonthTransactions]);

  // Calculate last month income and expenses for comparison
  const lastMonthIncome = useMemo(() => {
    return calculateTotalIncome(pastLastMonthTransactions);
  }, [pastLastMonthTransactions]);

  const lastMonthExpenses = useMemo(() => {
    return calculateTotalExpenses(pastLastMonthTransactions);
  }, [pastLastMonthTransactions]);

  // Calculate net worth (assets - debts) using filtered data
  const totalAssets = useMemo(() => {
    return filteredTotalBalance;
  }, [filteredTotalBalance]);

  // DEBTS: Sum of all liabilities and debts (using filtered data)
  const totalDebts = useMemo(() => {
    let total = 0;

    // Calculate from PlaidLiabilities (from Plaid connections)
    if (filteredLiabilities && filteredLiabilities.length > 0) {
      const liabilitiesTotal = filteredLiabilities.reduce((sum: number, liability: any) => {
        // Try balance first (for backward compatibility), then currentBalance
        const balance = liability.balance ?? liability.currentBalance ?? null;
        
        if (balance == null || balance === undefined) {
          return sum;
        }
        
        // Handle string, number, or null values
        let numValue: number;
        if (typeof balance === 'string') {
          numValue = parseFloat(balance);
        } else {
          numValue = Number(balance);
        }
        
        // Only add if it's a valid finite number (debts can be positive or zero)
        if (!isNaN(numValue) && isFinite(numValue)) {
          // For debts, we want the absolute value (a balance of -1000 means debt of 1000)
          // But if it's already positive, use it as-is
          const debtAmount = numValue < 0 ? Math.abs(numValue) : numValue;
          return sum + debtAmount;
        }
        
        return sum;
      }, 0);
      
      total += liabilitiesTotal;
    }

    // Calculate from Debt table (manually entered debts, only those not paid off)
    if (filteredDebts && filteredDebts.length > 0) {
      const debtsTotal = filteredDebts.reduce((sum: number, debt: any) => {
        // Only include debts that are not paid off
        if (debt.isPaidOff) {
          return sum;
        }
        
        // Use currentBalance from the Debt table
        const balance = debt.currentBalance ?? null;
        
        if (balance == null || balance === undefined) {
          return sum;
        }
        
        // Handle string, number, or null values
        let numValue: number;
        if (typeof balance === 'string') {
          numValue = parseFloat(balance);
        } else {
          numValue = Number(balance);
        }
        
        // Only add if it's a valid finite number and positive
        if (!isNaN(numValue) && isFinite(numValue) && numValue > 0) {
          return sum + numValue;
        }
        
        return sum;
      }, 0);
      
      total += debtsTotal;
    }

    return total;
  }, [filteredLiabilities, filteredDebts]);

  // NET WORTH = Total Assets - Total Debts
  const netWorth = totalAssets - totalDebts;

  // Use emergency fund months from financial health if available (more accurate)
  // Otherwise calculate from total balance and monthly expenses
  const monthlyExpenses = currentExpenses || 1; // Avoid division by zero
  const emergencyFundMonths = financialHealth?.emergencyFundMonths ?? 
    (filteredTotalBalance > 0 ? (filteredTotalBalance / monthlyExpenses) : 0);


  return (
    <div className="space-y-4 md:space-y-6">
      {/* Financial Overview Header with Last Updated and Refresh Button */}
      <div className="flex items-center justify-between gap-3">
        <Select
          value={selectedRange}
          onValueChange={handleRangeChange}
        >
          <SelectTrigger className="h-auto border-none shadow-none p-0 hover:bg-transparent focus:ring-0 focus:ring-offset-0 focus:outline-none data-[state=open]:ring-0 data-[state=open]:border-none data-[state=open]:shadow-none data-[state=open]:outline-none w-auto min-w-0 [&>span]:flex [&>span]:items-center [&>span]:gap-2 [&>svg]:hidden">
            <SelectValue>
              <h2 className="text-lg md:text-xl font-normal flex items-center gap-2 cursor-pointer transition-colors group">
                <span className="md:hidden">
                  <span className="font-bold group-hover:text-primary transition-colors">{getOverviewTitle(selectedRange).variable}</span>
                  <span className="group-hover:text-primary transition-colors"> {getOverviewTitle(selectedRange).overview}</span>
                </span>
                <span className="hidden md:inline">
                  <span className="font-bold group-hover:text-primary transition-colors">{getOverviewTitle(selectedRange).variable}</span>
                  <span className="group-hover:text-primary transition-colors"> {getOverviewTitle(selectedRange).overview}</span>
                </span>
                <ChevronDown className="h-4 w-4 opacity-50 flex-shrink-0 group-hover:opacity-70 transition-opacity" />
              </h2>
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="this-month">This month overview</SelectItem>
            <SelectItem value="last-month">Last month overview</SelectItem>
            <SelectItem value="last-60-days">Last 60 days overview</SelectItem>
            <SelectItem value="last-90-days">Last 90 days overview</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="h-8 w-8 flex-shrink-0"
            title="Refresh dashboard"
          >
            {isRefreshing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </Button>
          <span className="text-sm text-muted-foreground whitespace-nowrap">
            Updated {relativeTimeText}
          </span>
        </div>
      </div>
      
      {/* Financial Summary - Full Width */}
      <SummaryCards
        selectedMonthTransactions={pastSelectedMonthTransactions}
        lastMonthTransactions={pastLastMonthTransactions}
        savings={filteredSavings}
        totalBalance={filteredTotalBalance}
        lastMonthTotalBalance={filteredLastMonthTotalBalance}
        accounts={filteredAccounts}
        selectedMemberId={selectedMemberId}
        onMemberChange={setSelectedMemberId}
        householdMembers={householdMembers}
        isLoadingMembers={isLoadingMembers}
        financialHealth={financialHealth}
        expectedIncomeRange={expectedIncomeRange}
        recurringPayments={filteredRecurringPayments}
        subscriptions={filteredSubscriptions}
        goals={filteredGoals}
        debts={filteredDebts}
      />

      {/* Top Widgets - Spare Score and Expenses by Category side by side */}
      <div className="grid gap-4 md:gap-6 grid-cols-1 lg:grid-cols-2">
        <FinancialHealthScoreWidget
          financialHealth={financialHealth}
          selectedMonthTransactions={pastSelectedMonthTransactions}
          lastMonthTransactions={pastLastMonthTransactions}
          expectedIncomeRange={expectedIncomeRange}
        />
        <ExpensesByCategoryWidget
          selectedMonthTransactions={pastSelectedMonthTransactions}
          selectedMonthDate={selectedMonthDate}
        />
      </div>

      {/* Cash Flow Timeline and Budget Status side by side */}
      <div className="grid gap-4 md:gap-6 grid-cols-1 lg:grid-cols-2">
        <CashFlowTimelineWidget
          chartTransactions={filteredChartTransactions}
          selectedMonthDate={selectedMonthDate}
        />
        <BudgetStatusWidget
          budgets={filteredBudgets}
        />
      </div>

      {/* Recurring Payments and Savings Goals side by side */}
      <div className="grid gap-4 md:gap-6 grid-cols-1 lg:grid-cols-2">
      <RecurringPaymentsWidget
        recurringPayments={filteredRecurringPayments}
        monthlyIncome={currentIncome}
      />
        <SavingsGoalsWidget
          goals={filteredGoals}
        />
      </div>

      {/* Subscriptions Widget - Full Width */}
      <SubscriptionsWidget
        subscriptions={filteredSubscriptions}
      />

      {/* Dashboard Grid */}
      <div className="grid gap-4 md:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {/* Net Worth Snapshot and Investment Portfolio - side by side, full width */}
        <div className="col-span-full">
          <div className="grid gap-4 md:gap-6 grid-cols-1 md:grid-cols-2">
            <NetWorthWidget
              netWorth={netWorth}
              totalAssets={totalAssets}
              totalDebts={totalDebts}
            />
            <InvestmentPortfolioWidget
              savings={filteredSavings}
            />
          </div>
        </div>

      </div>
    </div>
  );
}

