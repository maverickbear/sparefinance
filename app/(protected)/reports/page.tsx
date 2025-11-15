"use client";

import { useState, useEffect } from "react";
import { ReportsContent } from "./reports-content";
import { ReportFilters, type ReportPeriod } from "@/components/reports/report-filters";
import { startOfMonth, endOfMonth, subMonths } from "date-fns";
import { getTransactionsClient } from "@/lib/api/transactions-client";
import { getBudgetsClient } from "@/lib/api/budgets-client";
import { getDebtsClient } from "@/lib/api/debts-client";
import { getGoalsClient } from "@/lib/api/goals-client";
import { getAccountsClient } from "@/lib/api/accounts-client";
import type { Transaction } from "@/lib/api/transactions-client";
import type { Budget } from "@/lib/api/budgets-client";
import type { Debt } from "@/lib/api/debts-client";
import type { Goal } from "@/lib/api/goals-client";
import type { Account } from "@/lib/api/accounts-client";
import type { FinancialHealthData } from "@/lib/api/financial-health";
import type { PortfolioSummary, HistoricalDataPoint } from "@/lib/api/portfolio";
import type { Holding } from "@/lib/api/investments";
import type { PlanFeatures } from "@/lib/validations/plan";
import { Loader2 } from "lucide-react";

export default function ReportsPage() {
  const [period, setPeriod] = useState<ReportPeriod>("last-12-months");
  const [loading, setLoading] = useState(true);
  const [limits, setLimits] = useState<PlanFeatures | null>(null);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [currentMonthTransactions, setCurrentMonthTransactions] = useState<Transaction[]>([]);
  const [historicalTransactions, setHistoricalTransactions] = useState<Transaction[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
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

        // Load limits
        try {
          const response = await fetch("/api/limits");
          if (response.ok) {
            const limitsData = await response.json();
            setLimits(limitsData);
          } else {
            // Use default limits if API fails
            setLimits({
              maxTransactions: 50,
              maxAccounts: 2,
              hasInvestments: false,
              hasAdvancedReports: false,
              hasCsvExport: false,
              hasDebts: true,
              hasGoals: true,
              hasBankIntegration: false,
              hasHousehold: false,
            });
          }
        } catch (error) {
          console.error("Error loading limits:", error);
          // Use default limits if API fails
          setLimits({
            maxTransactions: 50,
            maxAccounts: 2,
            hasInvestments: false,
            hasAdvancedReports: false,
            hasCsvExport: false,
            hasDebts: true,
            hasGoals: true,
            hasBankIntegration: false,
            hasHousehold: false,
          });
        }

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
        setBudgets(budgetsData);
        setDebts(debtsData);
        setGoals(goalsData);
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

        // Load portfolio data
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
      } catch (error) {
        console.error("Error loading reports data:", error);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [period]);

  if (loading || !limits) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <ReportFilters
        period={period}
        onPeriodChange={setPeriod}
      />
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
  );
}

