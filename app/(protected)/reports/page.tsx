"use client";

import { useState, useEffect } from "react";
import { usePagePerformance } from "@/hooks/use-page-performance";
import { ReportsContent } from "./reports-content";
import type { ReportPeriod } from "@/components/reports/report-filters";
import { ReportFilters } from "@/components/reports/report-filters";
import { startOfMonth, endOfMonth, subMonths } from "date-fns";
import { getTransactionsClient } from "@/lib/api/transactions-client";
import { getBudgetsClient } from "@/lib/api/budgets-client";
import { getDebtsClient } from "@/lib/api/debts-client";
import { getGoalsClient } from "@/lib/api/goals-client";
import { getAccountsClient } from "@/lib/api/accounts-client";
import type { Transaction } from "@/lib/api/transactions-client";
import type { Budget as BudgetClient } from "@/lib/api/budgets-client";
import type { Budget } from "@/lib/api/budgets";
import type { Debt } from "@/lib/api/debts-client";
import type { DebtWithCalculations } from "@/lib/api/debts";
import type { Goal } from "@/lib/api/goals-client";
import type { GoalWithCalculations } from "@/lib/api/goals";
import type { Account } from "@/lib/api/accounts-client";
import type { FinancialHealthData } from "@/lib/api/financial-health";
import type { PortfolioSummary, HistoricalDataPoint } from "@/lib/api/portfolio";
import type { Holding } from "@/lib/api/investments";
import type { PlanFeatures } from "@/lib/validations/plan";
import { Loader2 } from "lucide-react";
import { useSubscription } from "@/hooks/use-subscription";
import { PageHeader } from "@/components/common/page-header";

export default function ReportsPage() {
  const perf = usePagePerformance("Reports");
  const { limits, checking } = useSubscription();
  const [period, setPeriod] = useState<ReportPeriod>("last-12-months");
  const [loading, setLoading] = useState(true);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [currentMonthTransactions, setCurrentMonthTransactions] = useState<Transaction[]>([]);
  const [historicalTransactions, setHistoricalTransactions] = useState<Transaction[]>([]);
  const [debts, setDebts] = useState<DebtWithCalculations[]>([]);
  const [goals, setGoals] = useState<GoalWithCalculations[]>([]);
  const [financialHealth, setFinancialHealth] = useState<FinancialHealthData | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [portfolioSummary, setPortfolioSummary] = useState<PortfolioSummary | null>(null);
  const [portfolioHoldings, setPortfolioHoldings] = useState<Holding[]>([]);
  const [portfolioHistorical, setPortfolioHistorical] = useState<HistoricalDataPoint[]>([]);

  const getDateRange = (period: ReportPeriod): { startDate: Date; endDate: Date } => {
    const now = new Date();
    switch (period) {
      case "current-month":
        return {
          startDate: startOfMonth(now),
          endDate: endOfMonth(now),
        };
      case "last-3-months":
        return {
          startDate: startOfMonth(subMonths(now, 2)),
          endDate: endOfMonth(now),
        };
      case "last-6-months":
        return {
          startDate: startOfMonth(subMonths(now, 5)),
          endDate: endOfMonth(now),
        };
      case "last-12-months":
        return {
          startDate: startOfMonth(subMonths(now, 11)),
          endDate: endOfMonth(now),
        };
      case "year-to-date":
        return {
          startDate: new Date(now.getFullYear(), 0, 1),
          endDate: endOfMonth(now),
        };
      default:
        return {
          startDate: startOfMonth(now),
          endDate: endOfMonth(now),
        };
    }
  };

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const now = new Date();
        const currentMonth = startOfMonth(now);
        const endDate = endOfMonth(now);
        const dateRange = getDateRange(period);
        const historicalStartDate = dateRange.startDate;

        // Limits are already available via useSubscription hook
        // No need to fetch separately

        // Load transactions
        const [currentMonthTx, historicalTx] = await Promise.all([
          getTransactionsClient({
            startDate: currentMonth,
            endDate,
          }),
          getTransactionsClient({
            startDate: historicalStartDate,
            endDate: dateRange.endDate,
          }),
        ]);
        setCurrentMonthTransactions(currentMonthTx);
        setHistoricalTransactions(historicalTx);

        // Load other data
        const [
          budgetsData,
          debtsData,
          goalsData,
          accountsData,
        ] = await Promise.all([
          getBudgetsClient(now).catch(() => []),
          getDebtsClient().catch(() => []),
          getGoalsClient().catch(() => []),
          getAccountsClient().catch(() => []),
        ]);
        
        // Convert BudgetClient[] to Budget[] by mapping budgetCategories structure
        const convertedBudgets: Budget[] = budgetsData.map((budget: BudgetClient) => ({
          ...budget,
          budgetCategories: budget.budgetCategories?.map((bc: { category: { id: string; name: string } }) => ({
            id: '', // Will be set if needed
            budgetId: budget.id,
            categoryId: bc.category.id,
            category: bc.category,
          })) || [],
        }));
        
        setBudgets(convertedBudgets);
        
        // Convert Debt[] to DebtWithCalculations[] by ensuring required fields
        const convertedDebts: DebtWithCalculations[] = debtsData.map((debt: Debt) => ({
          ...debt,
          totalMonths: debt.totalMonths ?? null,
          remainingBalance: debt.remainingBalance ?? debt.currentBalance,
          remainingPrincipal: debt.remainingPrincipal ?? (debt.currentBalance - (debt.initialAmount - debt.downPayment - debt.principalPaid)),
          monthsRemaining: debt.monthsRemaining ?? null,
          totalInterestPaid: debt.totalInterestPaid ?? debt.interestPaid,
          totalInterestRemaining: debt.totalInterestRemaining ?? 0,
          progressPct: debt.progressPct ?? 0,
        }));
        setDebts(convertedDebts);
        
        // Convert Goal[] to GoalWithCalculations[] by ensuring required fields
        const convertedGoals = goalsData.map((goal: Goal) => ({
          ...goal,
          monthlyContribution: goal.monthlyContribution ?? 0,
          monthsToGoal: goal.monthsToGoal ?? null,
          progressPct: goal.progressPct ?? (goal.targetAmount > 0 ? (goal.currentBalance / goal.targetAmount) * 100 : 0),
          incomeBasis: goal.incomeBasis ?? 0,
        }));
        setGoals(convertedGoals);
        
        setAccounts(accountsData);

        // Load financial health (always use current month for financial health)
        try {
          const response = await fetch("/api/financial-health?date=" + encodeURIComponent(now.toISOString()));
          if (response.ok) {
            const healthData = await response.json();
            setFinancialHealth(healthData);
          }
        } catch (error) {
          console.error("Error loading financial health:", error);
        }

        // Load portfolio data only if user has access to investments
        // Safety check: convert string "true" to boolean (defensive programming)
        const hasInvestments = limits?.hasInvestments;
        if (hasInvestments === true || (typeof hasInvestments === "string" && hasInvestments === "true")) {
          try {
            const [summaryRes, holdingsRes, historicalRes] = await Promise.all([
              fetch("/api/portfolio/summary").then(r => r.ok ? r.json() : null),
              fetch("/api/portfolio/holdings").then(r => r.ok ? r.json() : null),
              fetch("/api/portfolio/historical").then(r => r.ok ? r.json() : null),
            ]);
            setPortfolioSummary(summaryRes);
            setPortfolioHoldings(holdingsRes || []);
            setPortfolioHistorical(historicalRes || []);
          } catch (error) {
            console.error("Error loading portfolio data:", error);
          }
        }
        
        perf.markDataLoaded();
      } catch (error) {
        console.error("Error loading reports data:", error);
        perf.markDataLoaded();
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [period, limits]);

  if (loading || checking || !limits) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Reports"
      >
        <ReportFilters
          period={period}
          onPeriodChange={setPeriod}
        />
      </PageHeader>

      <div className="w-full p-4 lg:p-8">
        <ReportsContent
          limits={limits}
          budgets={budgets}
          currentMonthTransactions={currentMonthTransactions}
          historicalTransactions={historicalTransactions}
          debts={debts}
          goals={goals}
          financialHealth={financialHealth}
          accounts={accounts}
          portfolioSummary={portfolioSummary}
          portfolioHoldings={portfolioHoldings}
          portfolioHistorical={portfolioHistorical}
          now={new Date()}
          period={period}
          dateRange={getDateRange(period)}
        />
      </div>
    </div>
  );
}

