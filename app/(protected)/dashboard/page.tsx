import { Suspense } from "react";
import dynamic from "next/dynamic";
import { MonthSelector } from "@/components/dashboard/month-selector";
import { SummaryCardSkeleton } from "@/components/ui/card-skeleton";
import { ChartSkeleton, BudgetExecutionSkeleton, CategoryExpensesSkeleton } from "@/components/ui/chart-skeleton";
import { ListSkeleton, GoalsOverviewSkeleton, FinancialHealthSkeleton } from "@/components/ui/list-skeleton";
import { loadDashboardData } from "./data-loader";
import { PageHeader } from "@/components/common/page-header";
import { getProfile } from "@/lib/api/profile";
import { DashboardRealtime } from "@/components/dashboard/dashboard-realtime";
import { DashboardUpdateChecker } from "@/components/dashboard/dashboard-update-checker";

// Lazy load the new Financial Overview page
const FinancialOverviewPage = dynamic(() => import("./financial-overview-page").then(m => ({ default: m.FinancialOverviewPage })), { ssr: true });
const OnboardingWidget = dynamic(() => import("@/components/dashboard/onboarding-widget").then(m => ({ default: m.OnboardingWidget })), { ssr: true });

interface DashboardProps {
  searchParams: Promise<{ month?: string }> | { month?: string };
}

async function DashboardContent({ selectedMonthDate }: { selectedMonthDate: Date }) {
  const data = await loadDashboardData(selectedMonthDate);

  return (
    <>
      {/* Onboarding Widget - Always show if status exists or if we need to check */}
      <OnboardingWidget initialStatus={data.onboardingStatus || undefined} />

      {/* Financial Overview Dashboard */}
      <FinancialOverviewPage
        selectedMonthTransactions={data.selectedMonthTransactions}
        lastMonthTransactions={data.lastMonthTransactions}
        savings={data.savings}
        totalBalance={data.totalBalance}
        lastMonthTotalBalance={data.lastMonthTotalBalance}
        accounts={data.accounts}
        budgets={data.budgets}
        upcomingTransactions={data.upcomingTransactions}
        financialHealth={data.financialHealth}
        goals={data.goals}
        chartTransactions={data.chartTransactions}
        liabilities={data.liabilities}
        debts={data.debts}
        selectedMonthDate={selectedMonthDate}
      />
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
    <div className="space-y-4 md:space-y-6 max-w-full overflow-x-hidden">
      <DashboardRealtime />
      <DashboardUpdateChecker />
      <PageHeader
        title="Financial Overview"
        description="Track your financial health: cash flow, spending, bills, buffers, risk and long-term planning."
      >
        <MonthSelector />
      </PageHeader>

      <Suspense fallback={
        <>
          {/* Summary Cards */}
          <div className="grid gap-4 md:gap-5 grid-cols-2 md:grid-cols-2 lg:grid-cols-4">
            <SummaryCardSkeleton />
            <SummaryCardSkeleton />
            <SummaryCardSkeleton />
            <SummaryCardSkeleton />
          </div>

          {/* Expenses Pie Chart and Savings Distribution Widget */}
          <div className="grid gap-4 md:gap-5 grid-cols-1 md:grid-cols-2">
            <ChartSkeleton height={400} />
            <ChartSkeleton height={400} />
          </div>

          {/* Cash Flow and Financial Health */}
          <div className="grid gap-4 md:gap-5 grid-cols-1 md:grid-cols-2">
            <ChartSkeleton height={240} />
            <FinancialHealthSkeleton />
          </div>

          {/* Upcoming Transactions and Budget Execution */}
          <div className="space-y-4">
            <ListSkeleton itemCount={5} />
            <div className="grid gap-4 md:gap-5 grid-cols-1 md:grid-cols-2">
              <BudgetExecutionSkeleton />
              <ChartSkeleton height={400} />
            </div>
          </div>

          {/* Charts */}
          <div className="grid gap-4 md:gap-5 grid-cols-1 md:grid-cols-2">
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

