"use client";

import { formatMoney } from "@/components/common/money";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format, startOfMonth, endOfMonth, eachMonthOfInterval, subMonths } from "date-fns";
import { PlanFeatures } from "@/lib/validations/plan";
import { FeatureGuard } from "@/components/common/feature-guard";
import type { Budget } from "@/lib/api/budgets";
import type { Transaction } from "@/lib/api/transactions-client";
import type { DebtWithCalculations } from "@/lib/api/debts";
import type { GoalWithCalculations } from "@/lib/api/goals";
import type { FinancialHealthData } from "@/lib/api/financial-health";
import type { Account } from "@/lib/api/accounts-client";
import type { PortfolioSummary, HistoricalDataPoint } from "@/lib/mock-data/portfolio-mock-data";
import type { Holding } from "@/lib/api/investments";
import { FinancialOverviewCard } from "@/components/reports/financial-overview-card";
import { InvestmentPerformanceSection } from "@/components/reports/investment-performance-section";
import { DebtAnalysisSection } from "@/components/reports/debt-analysis-section";
import { GoalsProgressSection } from "@/components/reports/goals-progress-section";
import { AccountBalancesSection } from "@/components/reports/account-balances-section";
import { SpendingPatternsSection } from "@/components/reports/spending-patterns-section";
import { FinancialHealthInsights } from "@/components/reports/financial-health-insights";
import { IncomeExpensesChart } from "@/components/charts/income-expenses-chart";
import { CategoryExpensesChart } from "@/components/charts/category-expenses-chart";

interface ReportsContentProps {
  limits: PlanFeatures;
  budgets: Budget[];
  currentMonthTransactions: Transaction[];
  historicalTransactions: Transaction[];
  debts: DebtWithCalculations[];
  goals: GoalWithCalculations[];
  financialHealth: FinancialHealthData | null;
  accounts: Account[];
  portfolioSummary: PortfolioSummary | null;
  portfolioHoldings: Holding[];
  portfolioHistorical: HistoricalDataPoint[];
  now: Date;
}

export function ReportsContent({
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
  now,
}: ReportsContentProps) {
  const currentMonth = startOfMonth(now);
  const lastMonth = subMonths(now, 1);
  const lastMonthStart = startOfMonth(lastMonth);
  const lastMonthEnd = endOfMonth(lastMonth);

  // Get last month transactions for comparison
  const lastMonthTransactions = historicalTransactions.filter(
    (tx) => {
      const txDate = new Date(tx.date);
      return txDate >= lastMonthStart && txDate <= lastMonthEnd;
    }
  );

  // Process monthly data for income/expenses chart (last 6 months)
  const sixMonthsAgo = subMonths(currentMonth, 5);
  const months = eachMonthOfInterval({
    start: sixMonthsAgo,
    end: currentMonth,
  });

  const monthlyData = months.map((month) => {
    const monthStart = startOfMonth(month);
    const monthEnd = endOfMonth(month);
    const monthTransactions = historicalTransactions.filter((tx) => {
      const txDate = new Date(tx.date);
      return txDate >= monthStart && txDate <= monthEnd;
    });

    const income = monthTransactions
      .filter((t) => t.type === "income")
      .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

    const expenses = monthTransactions
      .filter((t) => t.type === "expense")
      .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

    return {
      month: format(month, "MMM yyyy"),
      income,
      expenses,
    };
  });

  // Monthly Summary - expenses by category
  const expensesByCategory = currentMonthTransactions
    .filter((t) => t.type === "expense" && t.category)
    .reduce((acc, t) => {
      const catId = t.categoryId!;
      if (!acc[catId]) {
        acc[catId] = {
          name: t.category!.name,
          actual: 0,
          budget: 0,
        };
      }
      acc[catId].actual += t.amount;
      return acc;
    }, {} as Record<string, { name: string; actual: number; budget: number }>);

  // Merge with budgets
  budgets.forEach((budget) => {
    if (budget.categoryId && expensesByCategory[budget.categoryId]) {
      expensesByCategory[budget.categoryId].budget = budget.amount;
    }
  });

  // Category expenses data for chart
  const categoryExpensesData = Object.values(expensesByCategory).map((item) => ({
    name: item.name,
    value: item.actual,
    categoryId: Object.keys(expensesByCategory).find(
      (key) => expensesByCategory[key].name === item.name
    ),
  }));

  const currentIncome = currentMonthTransactions
    .filter((t) => t.type === "income")
    .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

  // Top 10 expenses
  const topExpenses = currentMonthTransactions
    .filter((t) => t.type === "expense")
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 10);

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="space-y-2">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Reports</h1>
          <p className="text-sm md:text-base text-muted-foreground">
            Complete financial overview and analysis for {format(now, "MMMM yyyy")}
          </p>
        </div>
      </div>

      {/* Financial Overview - Always visible */}
      <FinancialOverviewCard
        currentMonthTransactions={currentMonthTransactions}
        lastMonthTransactions={lastMonthTransactions}
        financialHealth={financialHealth}
        now={now}
      />

      {/* Tabs for organized sections */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 lg:grid-cols-7">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="income-expenses">Income & Expenses</TabsTrigger>
          <TabsTrigger value="investments">Investments</TabsTrigger>
          <TabsTrigger value="debts">Debts</TabsTrigger>
          <TabsTrigger value="goals">Goals</TabsTrigger>
          <TabsTrigger value="accounts">Accounts</TabsTrigger>
          <TabsTrigger value="insights">Insights</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          {/* Income vs Expenses Trend */}
          {monthlyData.length > 0 && (
            <IncomeExpensesChart data={monthlyData} />
          )}

          {/* Category Breakdown */}
          {categoryExpensesData.length > 0 && (
            <CategoryExpensesChart
              data={categoryExpensesData}
              totalIncome={currentIncome}
            />
          )}

          {/* Monthly Summary Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg md:text-xl">Monthly Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-[12px] border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs md:text-sm">Category</TableHead>
                      <TableHead className="text-right text-xs md:text-sm">Budget</TableHead>
                      <TableHead className="text-right text-xs md:text-sm">Actual</TableHead>
                      <TableHead className="text-right text-xs md:text-sm hidden md:table-cell">Difference</TableHead>
                      <TableHead className="text-right text-xs md:text-sm">%</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(Object.values(expensesByCategory) as Array<{ name: string; actual: number; budget: number }>).map((item) => {
                      const difference = item.actual - item.budget;
                      const percentage = item.budget > 0 ? (item.actual / item.budget) * 100 : 0;

                      return (
                        <TableRow key={item.name}>
                          <TableCell className="font-medium text-xs md:text-sm">{item.name}</TableCell>
                          <TableCell className="text-right font-medium text-xs md:text-sm">{formatMoney(item.budget)}</TableCell>
                          <TableCell className="text-right font-medium text-xs md:text-sm">{formatMoney(item.actual)}</TableCell>
                          <TableCell className={`text-right font-medium text-xs md:text-sm hidden md:table-cell ${
                            difference >= 0 ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"
                          }`}>
                            {difference >= 0 ? "+" : ""}{formatMoney(difference)}
                          </TableCell>
                          <TableCell className={`text-right font-medium text-xs md:text-sm ${
                            percentage > 100 ? "text-red-600 dark:text-red-400" :
                            percentage > 90 ? "text-yellow-600 dark:text-yellow-400" : "text-green-600 dark:text-green-400"
                          }`}>
                            {percentage.toFixed(1)}%
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {Object.values(expensesByCategory).length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="p-0">
                          <div className="flex items-center justify-center min-h-[400px] w-full">
                            <div className="text-center text-muted-foreground">
                              No expenses found for this month
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Top 10 Expenses */}
          <FeatureGuard feature="hasAdvancedReports" featureName="Advanced Reports">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg md:text-xl">Top 10 Expenses</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="rounded-[12px] border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs md:text-sm">Date</TableHead>
                        <TableHead className="text-xs md:text-sm hidden md:table-cell">Description</TableHead>
                        <TableHead className="text-xs md:text-sm">Category</TableHead>
                        <TableHead className="text-xs md:text-sm hidden sm:table-cell">Account</TableHead>
                        <TableHead className="text-right text-xs md:text-sm">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {topExpenses.map((tx) => (
                        <TableRow key={tx.id}>
                          <TableCell className="font-medium text-xs md:text-sm whitespace-nowrap">{format(new Date(tx.date), "MMM dd, yyyy")}</TableCell>
                          <TableCell className="text-xs md:text-sm hidden md:table-cell max-w-[150px] truncate">{tx.description || "-"}</TableCell>
                          <TableCell className="text-xs md:text-sm">
                            {tx.category?.name}
                            {tx.subcategory && ` / ${tx.subcategory.name}`}
                          </TableCell>
                          <TableCell className="text-xs md:text-sm hidden sm:table-cell">{tx.account?.name}</TableCell>
                          <TableCell className="text-right font-medium text-red-600 dark:text-red-400 text-xs md:text-sm">
                            {formatMoney(tx.amount)}
                          </TableCell>
                        </TableRow>
                      ))}
                      {topExpenses.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={5} className="p-0">
                            <div className="flex items-center justify-center min-h-[400px] w-full">
                              <div className="text-center text-muted-foreground">
                                No expenses found
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </FeatureGuard>
        </TabsContent>

        {/* Income & Expenses Tab */}
        <TabsContent value="income-expenses" className="space-y-4">
          {monthlyData.length > 0 && (
            <IncomeExpensesChart data={monthlyData} />
          )}
          {categoryExpensesData.length > 0 && (
            <CategoryExpensesChart
              data={categoryExpensesData}
              totalIncome={currentIncome}
            />
          )}
          <SpendingPatternsSection transactions={historicalTransactions} />
        </TabsContent>

        {/* Investments Tab */}
        <TabsContent value="investments" className="space-y-4">
          <InvestmentPerformanceSection
            portfolioSummary={portfolioSummary}
            portfolioHoldings={portfolioHoldings}
            portfolioHistorical={portfolioHistorical}
          />
        </TabsContent>

        {/* Debts Tab */}
        <TabsContent value="debts" className="space-y-4">
          <DebtAnalysisSection debts={debts} />
        </TabsContent>

        {/* Goals Tab */}
        <TabsContent value="goals" className="space-y-4">
          <GoalsProgressSection goals={goals} />
        </TabsContent>

        {/* Accounts Tab */}
        <TabsContent value="accounts" className="space-y-4">
          <AccountBalancesSection
            accounts={accounts}
            historicalTransactions={historicalTransactions}
            now={now}
          />
        </TabsContent>

        {/* Insights Tab */}
        <TabsContent value="insights" className="space-y-4">
          <FinancialHealthInsights financialHealth={financialHealth} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

