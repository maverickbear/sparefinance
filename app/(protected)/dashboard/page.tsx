import { Suspense } from "react";
import { MonthSelector } from "@/components/dashboard/month-selector";
import { SummaryCardSkeleton } from "@/components/ui/card-skeleton";
import { ChartSkeleton, BudgetExecutionSkeleton, CategoryExpensesSkeleton } from "@/components/ui/chart-skeleton";
import { ListSkeleton, GoalsOverviewSkeleton, FinancialHealthSkeleton } from "@/components/ui/list-skeleton";
import { SummaryCards } from "./summary-cards";
import { CashFlowSection } from "./cash-flow-section";
import { TransactionsBudgetSection } from "./transactions-budget-section";
import { ChartsSection } from "./charts-section";
import { OnboardingWidget } from "@/components/dashboard/onboarding-widget";
import { loadDashboardData } from "./data-loader";

interface DashboardProps {
  searchParams: Promise<{ month?: string }> | { month?: string };
}

async function DashboardContent({ selectedMonthDate }: { selectedMonthDate: Date }) {
  const data = await loadDashboardData(selectedMonthDate);

  return (
    <>
      {/* Onboarding Widget */}
      {data.onboardingStatus && (
        <OnboardingWidget initialStatus={data.onboardingStatus} />
      )}

      {/* Summary Cards */}
      <SummaryCards 
        selectedMonthTransactions={data.selectedMonthTransactions}
        lastMonthTransactions={data.lastMonthTransactions}
        savings={data.savings}
        totalBalance={data.totalBalance}
        lastMonthTotalBalance={data.lastMonthTotalBalance}
        accounts={data.accounts}
      />

      {/* Cash Flow and Financial Health */}
      <CashFlowSection 
        chartTransactions={data.chartTransactions}
        financialHealth={data.financialHealth}
        selectedMonthDate={selectedMonthDate}
      />

      {/* Upcoming Transactions and Budget Execution */}
      <TransactionsBudgetSection 
        budgets={data.budgets}
        upcomingTransactions={data.upcomingTransactions}
      />

      {/* Charts */}
      <ChartsSection 
        selectedMonthTransactions={data.selectedMonthTransactions}
        goals={data.goals}
      />
    </>
  );
}

export default async function Dashboard({ searchParams }: DashboardProps) {
  // Get selected month from URL or use current month
  const params = await Promise.resolve(searchParams);
  const selectedMonthParam = params?.month;
  const selectedMonthDate = selectedMonthParam 
    ? new Date(selectedMonthParam)
    : new Date();

  return (
    <div className="space-y-6 md:space-y-10">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Dashboard</h1>
          <p className="text-sm md:text-base text-muted-foreground">Overview of your finances</p>
        </div>
        <MonthSelector />
      </div>

      <Suspense fallback={
        <>
          {/* Summary Cards */}
          <div className="grid gap-6 md:gap-8 grid-cols-2 md:grid-cols-2 lg:grid-cols-4">
            <SummaryCardSkeleton />
            <SummaryCardSkeleton />
            <SummaryCardSkeleton />
            <SummaryCardSkeleton />
          </div>

          {/* Cash Flow and Financial Health */}
          <div className="grid gap-6 md:gap-8 grid-cols-1 md:grid-cols-2">
            <ChartSkeleton height={240} />
            <FinancialHealthSkeleton />
          </div>

          {/* Upcoming Transactions and Budget Execution */}
          <div className="grid gap-6 md:gap-8 grid-cols-1 md:grid-cols-2">
            <ListSkeleton itemCount={5} />
            <BudgetExecutionSkeleton />
          </div>

          {/* Charts */}
          <div className="grid gap-6 md:gap-8 grid-cols-1 md:grid-cols-2">
            <GoalsOverviewSkeleton />
            <CategoryExpensesSkeleton />
          </div>
        </>
      }>
        <DashboardContent selectedMonthDate={selectedMonthDate} />
      </Suspense>
    </div>
  );
}

