import { Suspense } from "react";
import nextDynamic from "next/dynamic";
import { MonthSelector } from "@/components/dashboard/month-selector";
import { loadDashboardData } from "./data-loader";
import { PageHeader } from "@/components/common/page-header";
import { getProfile } from "@/lib/api/profile";
import { DashboardRealtime } from "@/components/dashboard/dashboard-realtime";
import { DashboardUpdateChecker } from "@/components/dashboard/dashboard-update-checker";
import { UrlCleanup } from "@/components/common/url-cleanup";
import { startServerPagePerformance } from "@/lib/utils/performance";

// Force dynamic rendering since this page uses cookies for authentication
export const dynamic = 'force-dynamic';

// Lazy load the new Financial Overview page
const FinancialOverviewPage = nextDynamic(() => import("./financial-overview-page").then(m => ({ default: m.FinancialOverviewPage })), { ssr: true });
const OnboardingWidget = nextDynamic(() => import("@/components/dashboard/onboarding-widget").then(m => ({ default: m.OnboardingWidget })), { ssr: true });

interface DashboardProps {
  searchParams: Promise<{ month?: string }>;
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
        recurringPayments={data.recurringPayments}
        subscriptions={data.subscriptions}
        selectedMonthDate={selectedMonthDate}
        expectedIncomeRange={data.expectedIncomeRange}
      />
    </>
  );
}

export default async function Dashboard({ searchParams }: DashboardProps) {
  const perf = startServerPagePerformance("Dashboard");
  
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
  
  perf.end();

  return (
    <div>
      <Suspense fallback={null}>
        <UrlCleanup />
      </Suspense>
      <DashboardRealtime />
      <DashboardUpdateChecker />
      <PageHeader
        title={`Welcome, ${firstName}`}
      >
        <MonthSelector />
      </PageHeader>

      <div className="w-full p-4 lg:p-8">
        <Suspense fallback={null}>
          <DashboardContent selectedMonthDate={selectedMonth} />
        </Suspense>
      </div>
    </div>
  );
}

