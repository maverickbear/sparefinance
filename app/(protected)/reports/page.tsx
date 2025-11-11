import { getBudgets } from "@/lib/api/budgets";
import { getTransactions } from "@/lib/api/transactions";
import { startOfMonth, endOfMonth, subMonths } from "date-fns";
import { getCurrentUserLimits } from "@/lib/api/limits";
import { ReportsContent } from "./reports-content";
import { getDebts } from "@/lib/api/debts";
import { getGoals } from "@/lib/api/goals";
import { calculateFinancialHealth } from "@/lib/api/financial-health";
import { getAccounts } from "@/lib/api/accounts";
import { getPortfolioSummary, getPortfolioHoldings, getPortfolioHistoricalData } from "@/lib/api/portfolio";

export default async function ReportsPage() {
  const now = new Date();
  const currentMonth = startOfMonth(now);
  const endDate = endOfMonth(now);
  
  // Calculate date range for historical data (last 12 months)
  const twelveMonthsAgo = subMonths(currentMonth, 12);
  const historicalStartDate = startOfMonth(twelveMonthsAgo);

  // Fetch all data in parallel for better performance
  const [
    limits,
    budgets,
    currentMonthTransactions,
    historicalTransactions,
    debts,
    goals,
    financialHealth,
    accounts,
    portfolioSummary,
    portfolioHoldings,
    portfolioHistorical,
  ] = await Promise.all([
    getCurrentUserLimits(),
    getBudgets(now),
    getTransactions({
      startDate: currentMonth,
      endDate,
    }),
    getTransactions({
      startDate: historicalStartDate,
      endDate,
    }),
    getDebts().catch(() => []),
    getGoals().catch(() => []),
    calculateFinancialHealth(now).catch(() => null),
    getAccounts().catch(() => []),
    getPortfolioSummary().catch(() => null),
    getPortfolioHoldings().catch(() => []),
    getPortfolioHistoricalData(365).catch(() => []),
  ]);

  return (
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
      now={now}
    />
  );
}

