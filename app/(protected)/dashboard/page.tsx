import { Suspense } from "react";
import dynamic from "next/dynamic";
import { MonthSelector } from "@/components/dashboard/month-selector";
import { SummaryCardSkeleton } from "@/components/ui/card-skeleton";
import { ChartSkeleton, BudgetExecutionSkeleton, CategoryExpensesSkeleton } from "@/components/ui/chart-skeleton";
import { ListSkeleton, GoalsOverviewSkeleton, FinancialHealthSkeleton } from "@/components/ui/list-skeleton";
import { SummaryCards } from "./summary-cards";
import { loadDashboardData } from "./data-loader";
import { PageHeader } from "@/components/common/page-header";
import { getProfile } from "@/lib/api/profile";

// Lazy load heavy chart components
const CashFlowSection = dynamic(() => import("./cash-flow-section").then(m => ({ default: m.CashFlowSection })), { ssr: true });
const TransactionsBudgetSection = dynamic(() => import("./transactions-budget-section").then(m => ({ default: m.TransactionsBudgetSection })), { ssr: true });
const ChartsSection = dynamic(() => import("./charts-section").then(m => ({ default: m.ChartsSection })), { ssr: true });
const OnboardingWidget = dynamic(() => import("@/components/dashboard/onboarding-widget").then(m => ({ default: m.OnboardingWidget })), { ssr: true });
const SavingsDistributionWidget = dynamic(() => import("@/components/dashboard/savings-distribution-widget").then(m => ({ default: m.SavingsDistributionWidget })), { ssr: true });
const ExpensesPieChartWidget = dynamic(() => import("@/components/dashboard/expenses-pie-chart-widget").then(m => ({ default: m.ExpensesPieChartWidget })), { ssr: true });
const AIChat = dynamic(() => import("@/components/dashboard/ai-chat").then(m => ({ default: m.AIChat })), { ssr: false });

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

      {/* Expenses Pie Chart and Savings Distribution Widget */}
      <div className="grid gap-4 sm:gap-5 grid-cols-1 md:grid-cols-2">
        <ExpensesPieChartWidget
          selectedMonthTransactions={data.selectedMonthTransactions}
        />
        <SavingsDistributionWidget
          selectedMonthTransactions={data.selectedMonthTransactions}
          lastMonthTransactions={data.lastMonthTransactions}
          goals={data.goals}
        />
      </div>

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

      {/* AI Chat Assistant */}
      <div className="h-[600px]">
        <AIChat />
      </div>
    </>
  );
}

export default async function Dashboard({ searchParams }: DashboardProps) {
  // Get selected month from URL or use current month
  const params = await Promise.resolve(searchParams);
  const selectedMonthParam = params?.month;
  const selectedMonthDate = selectedMonthParam 
    ? (() => {
        // Parse YYYY-MM-DD format and create date in local timezone
        const [year, month, day] = selectedMonthParam.split('-').map(Number);
        return new Date(year, month - 1, day);
      })()
    : new Date();

  // Ensure we're using the start of the month for consistency
  const selectedMonth = new Date(selectedMonthDate.getFullYear(), selectedMonthDate.getMonth(), 1);
  
  // Get user profile to personalize the header
  const profile = await getProfile();
  const firstName = profile?.name?.split(' ')[0] || 'there';
  
  // Log removed for production performance

  return (
    <div className="space-y-4 sm:space-y-5 md:space-y-6">
      <PageHeader
        title={`Welcome, ${firstName}`}
        description="See your money move — and make it work for you."
      >
        <MonthSelector />
      </PageHeader>

      <Suspense fallback={
        <>
          {/* Summary Cards */}
          <div className="grid gap-3 sm:gap-4 md:gap-5 grid-cols-2 md:grid-cols-2 lg:grid-cols-4">
            <SummaryCardSkeleton />
            <SummaryCardSkeleton />
            <SummaryCardSkeleton />
            <SummaryCardSkeleton />
          </div>

          {/* Expenses Pie Chart and Savings Distribution Widget */}
          <div className="grid gap-4 sm:gap-5 grid-cols-1 md:grid-cols-2">
            <ChartSkeleton height={400} />
            <ChartSkeleton height={400} />
          </div>

          {/* Cash Flow and Financial Health */}
          <div className="grid gap-4 sm:gap-5 grid-cols-1 md:grid-cols-2">
            <ChartSkeleton height={240} />
            <FinancialHealthSkeleton />
          </div>

          {/* Upcoming Transactions and Budget Execution */}
          <div className="grid gap-4 sm:gap-5 grid-cols-1 md:grid-cols-2">
            <ListSkeleton itemCount={5} />
            <BudgetExecutionSkeleton />
          </div>

          {/* Charts */}
          <div className="grid gap-4 sm:gap-5 grid-cols-1 md:grid-cols-2">
            <GoalsOverviewSkeleton />
            <CategoryExpensesSkeleton />
          </div>
        </>
      }>
        <DashboardContent selectedMonthDate={selectedMonth} />
      </Suspense>
    </div>
  );
}

