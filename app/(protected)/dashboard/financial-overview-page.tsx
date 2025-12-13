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
import { BalanceCard } from "./balance-card";
import { FinancialHealthScoreWidget } from "./widgets/financial-health-score-widget";
import { QuickStatsWidget } from "./widgets/quick-stats-widget";
import { MoneyFlowMetricsWidget } from "./widgets/money-flow-metrics-widget";
import { BudgetOverviewWidget } from "./widgets/budget-overview-widget";
import { AccountsOverviewWidget } from "./widgets/accounts-overview-widget";
import { DebtsOverviewWidget } from "./widgets/debts-overview-widget";
import { RecentTransactionsWidget } from "./widgets/recent-transactions-widget";
import { SubscriptionsRecurringGoalsWidget } from "./widgets/subscriptions-recurring-goals-widget";
import { SectionHeader } from "./section-header";
import { calculateTotalIncome, calculateTotalExpenses } from "./utils/transaction-helpers";
import { formatMonthlyIncomeFromRange } from "@/src/presentation/utils/format-expected-income";
import { format } from "date-fns";
// Using API route instead of client-side API
import type { HouseholdMember } from "@/src/domain/members/members.types";
import { calculateLastMonthBalanceFromCurrent } from "@/lib/services/balance-calculator";
import type { TransactionWithRelations, UpcomingTransaction } from "@/src/domain/transactions/transactions.types";
import type { AccountWithBalance } from "@/src/domain/accounts/accounts.types";
import type { BudgetWithRelations } from "@/src/domain/budgets/budgets.types";
import type { GoalWithCalculations } from "@/src/domain/goals/goals.types";
import type { DebtWithCalculations } from "@/src/domain/debts/debts.types";
import type { BasePlannedPayment } from "@/src/domain/planned-payments/planned-payments.types";
import type { UserServiceSubscription } from "@/src/domain/subscriptions/subscriptions.types";
import type { FinancialHealthData } from "@/src/application/shared/financial-health";

// Lazy load widgets with heavy chart libraries (recharts) - no SSR
const NetWorthWidget = dynamic(
  () => import("./widgets/net-worth-widget").then(m => ({ default: m.NetWorthWidget })),
  { 
    ssr: false, // recharts doesn't work well with SSR
    loading: () => <ChartSkeleton height={300} />
  }
);

const InvestmentPortfolioWidget = dynamic(
  () => import("./widgets/investment-portfolio-widget").then(m => ({ default: m.InvestmentPortfolioWidget })),
  { 
    ssr: false, // recharts doesn't work well with SSR
    loading: () => <CardSkeleton />
  }
);

const PlannedPaymentWidget = dynamic(
  () => import("./widgets/planned-payment-widget").then(m => ({ default: m.PlannedPaymentWidget })),
  { 
    ssr: true,
    loading: () => <CardSkeleton />
  }
);

interface ChartTransactionData {
  month: string;
  income: number;
  expenses: number;
}

interface FinancialOverviewPageProps {
  selectedMonthTransactions: TransactionWithRelations[];
  lastMonthTransactions: TransactionWithRelations[];
  savings: number;
  totalBalance: number;
  lastMonthTotalBalance: number;
  accounts: AccountWithBalance[];
  budgets: BudgetWithRelations[];
  upcomingTransactions: UpcomingTransaction[];
  financialHealth: FinancialHealthData;
  goals: GoalWithCalculations[];
  chartTransactions: ChartTransactionData[];
  liabilities: AccountWithBalance[];
  debts: DebtWithCalculations[];
  recurringPayments: TransactionWithRelations[];
  subscriptions: UserServiceSubscription[];
  plannedPayments: BasePlannedPayment[];
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
  plannedPayments: initialPlannedPayments,
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
  const [plannedPayments, setPlannedPayments] = useState(initialPlannedPayments);
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
    setPlannedPayments(initialPlannedPayments);
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
    initialPlannedPayments,
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

  // Load secondary dashboard data from window (loaded via Suspense)
  useEffect(() => {
    const checkSecondaryData = () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const secondaryData = (window as { __SECONDARY_DASHBOARD_DATA__?: unknown }).__SECONDARY_DASHBOARD_DATA__ as {
        lastMonthTransactions?: TransactionWithRelations[];
        lastMonthTotalBalance?: number;
        chartTransactions?: ChartTransactionData[];
        debts?: DebtWithCalculations[];
        recurringPayments?: TransactionWithRelations[];
        subscriptions?: UserServiceSubscription[];
      } | undefined;
      if (secondaryData) {
        // Update state with secondary data
        if (secondaryData.lastMonthTransactions) {
          setLastMonthTransactions(secondaryData.lastMonthTransactions);
        }
        if (secondaryData.lastMonthTotalBalance !== undefined) {
          setLastMonthTotalBalance(secondaryData.lastMonthTotalBalance);
        }
        if (secondaryData.chartTransactions) {
          setChartTransactions(secondaryData.chartTransactions);
        }
        if (secondaryData.debts) {
          setDebts(secondaryData.debts);
        }
        if (secondaryData.recurringPayments) {
          setRecurringPayments(secondaryData.recurringPayments);
        }
        if (secondaryData.subscriptions) {
          setSubscriptions(secondaryData.subscriptions);
        }
      }
    };

    // Check immediately
    checkSecondaryData();

    // Also check periodically in case data loads after component mounts
    const interval = setInterval(checkSecondaryData, 500);
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
    return accounts.filter((acc: AccountWithBalance) => {
      // Use String() to ensure type consistency in comparison
      if (String(acc.userId) === String(selectedMemberId)) {
        return true;
      }
      if (acc.ownerIds && Array.isArray(acc.ownerIds)) {
        return acc.ownerIds.some((id: string) => String(id) === String(selectedMemberId));
      }
      return false;
    });
  }, [accounts, selectedMemberId]);

  // Recalculate totalBalance and savings based on filtered accounts
  const filteredTotalBalance = useMemo(() => {
    return filteredAccounts.reduce((sum: number, acc: AccountWithBalance) => sum + (acc.balance || 0), 0);
  }, [filteredAccounts]);

  const filteredSavings = useMemo(() => {
    return filteredAccounts
      .filter((acc: AccountWithBalance) => acc.type === 'savings')
      .reduce((sum: number, acc: AccountWithBalance) => sum + (acc.balance || 0), 0);
  }, [filteredAccounts]);

  // Filter transactions by selected household member
  const filterTransactionsByMember = useCallback((transactions: TransactionWithRelations[]) => {
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
      setPlannedPayments(data.plannedPayments || []);
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

  // Chart transactions are aggregated data and don't need member filtering
  const filteredChartTransactions = useMemo(() => {
    return chartTransactions;
  }, [chartTransactions]);

  // Filter other data by household member
  const filteredBudgets = useMemo(() => {
    if (!selectedMemberId) {
      return budgets;
    }
    return budgets.filter((b: BudgetWithRelations) => b.userId === selectedMemberId);
  }, [budgets, selectedMemberId]);

  const filteredGoals = useMemo(() => {
    if (!selectedMemberId) {
      return goals;
    }
    return goals.filter((g: GoalWithCalculations) => g.userId === selectedMemberId);
  }, [goals, selectedMemberId]);

  const filteredRecurringPayments = useMemo(() => {
    if (!selectedMemberId) {
      return recurringPayments;
    }
    return recurringPayments.filter((rp: TransactionWithRelations) => rp.userId === selectedMemberId);
  }, [recurringPayments, selectedMemberId]);

  const filteredSubscriptions = useMemo(() => {
    if (!selectedMemberId) {
      return subscriptions;
    }
    return subscriptions.filter((s: UserServiceSubscription) => s.userId === selectedMemberId);
  }, [subscriptions, selectedMemberId]);

  const filteredDebts = useMemo(() => {
    if (!selectedMemberId) {
      return debts;
    }
    return debts.filter((d: DebtWithCalculations) => d.userId === selectedMemberId);
  }, [debts, selectedMemberId]);

  const filteredLiabilities = useMemo(() => {
    if (!selectedMemberId) {
      return liabilities;
    }
    // Filter liabilities by account ownership
    const filteredAccountIds = new Set(filteredAccounts.map((acc: AccountWithBalance) => acc.id));
    return liabilities.filter((l: AccountWithBalance) => filteredAccountIds.has(l.id));
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

    // Calculate from liabilities (manually entered)
    if (filteredLiabilities && filteredLiabilities.length > 0) {
      const liabilitiesTotal = filteredLiabilities.reduce((sum: number, liability: AccountWithBalance) => {
        // Use balance from AccountWithBalance
        const balance = liability.balance ?? null;
        
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
      const debtsTotal = filteredDebts.reduce((sum: number, debt: DebtWithCalculations) => {
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

  // Calculate metrics for QuickStatsWidget
  const netCashFlow = currentIncome - currentExpenses;
  const monthlySavings = netCashFlow; // Savings = income - expenses
  const savingsRate = currentIncome > 0 ? (monthlySavings / currentIncome) * 100 : 0;
  
  // Calculate expected monthly income from range
  const expectedMonthlyIncome = useMemo(() => {
    if (!expectedIncomeRange) return undefined;
    // Use the same logic as formatMonthlyIncomeFromRange but return number
    const range = expectedIncomeRange as string;
    const INCOME_RANGE_TO_MONTHLY: Record<string, number> = {
      "0-50k": 25000 / 12,
      "50k-100k": 75000 / 12,
      "100k-150k": 125000 / 12,
      "150k-250k": 200000 / 12,
      "250k+": 300000 / 12,
    };
    return INCOME_RANGE_TO_MONTHLY[range] || undefined;
  }, [expectedIncomeRange]);

  // Calculate budgeted expenses (sum of all budgets)
  const budgetedExpenses = useMemo(() => {
    return filteredBudgets.reduce((sum, budget) => sum + (budget.amount || 0), 0);
  }, [filteredBudgets]);

  // Calculate savings goal (from goals or use a default)
  const savingsGoal = useMemo(() => {
    // Try to find a savings goal
    const savingsGoal = filteredGoals.find(g => 
      !g.isCompleted && 
      (g.name?.toLowerCase().includes("savings") || g.name?.toLowerCase().includes("emergency"))
    );
    return savingsGoal?.targetAmount || undefined;
  }, [filteredGoals]);

  // Calculate income/expenses change percentages
  const incomeChangePercent = useMemo(() => {
    if (lastMonthIncome > 0) {
      return ((currentIncome - lastMonthIncome) / lastMonthIncome) * 100;
    }
    return undefined;
  }, [currentIncome, lastMonthIncome]);

  const expensesChangePercent = useMemo(() => {
    if (budgetedExpenses > 0) {
      return ((monthlyExpenses - budgetedExpenses) / budgetedExpenses) * 100;
    } else if (lastMonthExpenses > 0) {
      return ((monthlyExpenses - lastMonthExpenses) / lastMonthExpenses) * 100;
    }
    return undefined;
  }, [monthlyExpenses, budgetedExpenses, lastMonthExpenses]);

  // Get credit card accounts for DebtsOverviewWidget
  const creditCardAccounts = useMemo(() => {
    return filteredAccounts.filter(acc => acc.type === "credit");
  }, [filteredAccounts]);


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
      
      {/* Balance - Full Width */}
        <div>
        <BalanceCard
            totalBalance={filteredTotalBalance}
            lastMonthTotalBalance={filteredLastMonthTotalBalance}
            accounts={filteredAccounts}
            selectedMemberId={selectedMemberId}
            onMemberChange={setSelectedMemberId}
            householdMembers={householdMembers}
            isLoadingMembers={isLoadingMembers}
          pastSelectedMonthTransactions={pastSelectedMonthTransactions}
            recurringPayments={filteredRecurringPayments}
            subscriptions={filteredSubscriptions}
            plannedPayments={plannedPayments}
            goals={filteredGoals}
            debts={filteredDebts}
        />
      </div>

      {/* SECTION 1: Financial Health */}
      <section className="space-y-4 md:space-y-6">
        <SectionHeader
          title="How you're doing right now"
          subtitle="Your financial health at a glance: score, savings, cash flow and safety net."
          action={
            <button
              onClick={() => router.push("/insights")}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs hover:bg-muted transition-colors"
            >
              <span>Spare Score report</span>
              <span>›</span>
            </button>
          }
        />

        <div className="grid gap-4 md:gap-6 grid-cols-1 lg:grid-cols-[1.2fr_1fr]">
          {/* Left - Spare Score */}
          <FinancialHealthScoreWidget
            financialHealth={financialHealth}
            selectedMonthTransactions={pastSelectedMonthTransactions}
            lastMonthTransactions={pastLastMonthTransactions}
            expectedIncomeRange={expectedIncomeRange}
          />

          {/* Right - Quick Stats */}
          <QuickStatsWidget
            netCashFlow={netCashFlow}
            savingsRate={savingsRate}
            savingsRateTarget={15}
            emergencyFundMonths={emergencyFundMonths}
            recommendedEmergencyFundMonths={6}
          />
        </div>
      </section>

      {/* SECTION 2: Money Flow */}
      <section className="space-y-4 md:space-y-6">
        <SectionHeader
          title="Where your money is going this month"
          subtitle="See how income, expenses and budgets shape this month's story."
          action={
            <div className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs">
              <span>{format(selectedMonthDate, "MMMM")} • This month</span>
            </div>
          }
        />

        {/* Top metrics */}
        <MoneyFlowMetricsWidget
          monthlyIncome={currentIncome}
          expectedIncome={expectedMonthlyIncome}
          incomeChangePercent={incomeChangePercent}
          monthlyExpenses={monthlyExpenses}
          budgetedExpenses={budgetedExpenses}
          expensesChangePercent={expensesChangePercent}
          monthlySavings={monthlySavings}
          savingsGoal={savingsGoal}
          savingsChangeText={monthlySavings > 0 ? "Better than last month" : undefined}
        />

        {/* Flow details */}
        <div className="grid gap-4 md:gap-6 grid-cols-1 lg:grid-cols-2">
          {/* Upcoming payments */}
          <PlannedPaymentWidget
            upcomingTransactions={upcomingTransactions}
          />

          {/* Budget overview */}
          <BudgetOverviewWidget
            budgets={filteredBudgets}
          />
        </div>
      </section>

      {/* SECTION 3: Accounts & Net Worth */}
      <section className="space-y-4 md:space-y-6">
        <SectionHeader
          title="What you've built so far"
          subtitle="Your assets, debts and net worth across every account you've connected."
        />

        <div className="grid gap-4 md:gap-6 grid-cols-1 lg:grid-cols-2">
          {/* Net worth snapshot */}
          <NetWorthWidget
            netWorth={netWorth}
            totalAssets={totalAssets}
            totalDebts={totalDebts}
          />

          {/* Accounts overview */}
          <AccountsOverviewWidget
            accounts={filteredAccounts}
            liabilities={filteredLiabilities}
            debts={filteredDebts}
          />
        </div>

        <div className="grid gap-4 md:gap-6 grid-cols-1 lg:grid-cols-2">
          {/* Debts */}
          <DebtsOverviewWidget
            creditCardAccounts={creditCardAccounts}
            debts={filteredDebts}
          />

          {/* Investments */}
          <InvestmentPortfolioWidget
            savings={filteredSavings}
          />
        </div>
      </section>

      {/* SECTION 4: Activity & Insights */}
      <section className="space-y-4 md:space-y-6">
        <SectionHeader
          title="What changed recently"
          subtitle="Latest transactions, subscriptions and goals that might need your attention."
        />

        <div className="grid gap-4 md:gap-6 grid-cols-1 lg:grid-cols-2">
          {/* Recent transactions */}
          <RecentTransactionsWidget
            transactions={pastSelectedMonthTransactions}
          />

          {/* Subscriptions, recurring & goals */}
          <SubscriptionsRecurringGoalsWidget
            subscriptions={filteredSubscriptions}
            recurringPayments={filteredRecurringPayments}
            goals={filteredGoals}
          />
        </div>
      </section>
    </div>
  );
}

