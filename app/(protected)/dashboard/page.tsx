import { Suspense } from "react";
import nextDynamic from "next/dynamic";
import { loadDashboardData } from "./data-loader";
import { PageHeader } from "@/components/common/page-header";
import { DashboardHeaderActions } from "@/components/dashboard/dashboard-header-actions";
import { makeProfileService } from "@/src/application/profile/profile.factory";
import { makeOnboardingDecisionService } from "@/src/application/onboarding/onboarding.factory";
import { makeOnboardingService } from "@/src/application/onboarding/onboarding.factory";
import { getCurrentUserId } from "@/src/application/shared/feature-guard";
import { DashboardRealtime } from "@/components/dashboard/dashboard-realtime";
import { DashboardUpdateChecker } from "@/components/dashboard/dashboard-update-checker";
import { TrialCelebration } from "@/components/dashboard/trial-celebration";
import { UrlCleanup } from "@/components/common/url-cleanup";
import { startServerPagePerformance } from "@/lib/utils/performance";
import { startOfMonth, endOfMonth, subMonths, subDays } from "date-fns";
import { cookies } from "next/headers";
import { DashboardSkeleton } from "./dashboard-skeleton";

// Lazy load the new Financial Overview page
const FinancialOverviewPage = nextDynamic(() => import("./financial-overview-page").then(m => ({ default: m.FinancialOverviewPage })), { ssr: true });
// CRITICAL: Don't lazy load OnboardingDialogWrapper - it needs to render immediately
// Import directly to ensure zero delay for new users
import { OnboardingDialogWrapper } from "@/src/presentation/components/features/onboarding/onboarding-dialog-wrapper";

type DateRange = "this-month" | "last-month" | "last-60-days" | "last-90-days";

interface DashboardProps {
  searchParams: Promise<{ month?: string; range?: string }>;
}

function calculateDateRange(range: DateRange): { startDate: Date; endDate: Date; selectedMonthDate: Date } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  let startDate: Date;
  let endDate: Date;
  let selectedMonthDate: Date;
  
  switch (range) {
    case "this-month":
      startDate = startOfMonth(today);
      endDate = endOfMonth(today);
      selectedMonthDate = startDate;
      break;
    case "last-month":
      const lastMonth = subMonths(today, 1);
      startDate = startOfMonth(lastMonth);
      endDate = endOfMonth(lastMonth);
      selectedMonthDate = startDate;
      break;
    case "last-60-days":
      endDate = new Date(today);
      endDate.setHours(23, 59, 59, 999);
      startDate = subDays(today, 59);
      startDate.setHours(0, 0, 0, 0);
      selectedMonthDate = startDate; // Use start date for compatibility
      break;
    case "last-90-days":
      endDate = new Date(today);
      endDate.setHours(23, 59, 59, 999);
      startDate = subDays(today, 89);
      startDate.setHours(0, 0, 0, 0);
      selectedMonthDate = startDate; // Use start date for compatibility
      break;
    default:
      startDate = startOfMonth(today);
      endDate = endOfMonth(today);
      selectedMonthDate = startDate;
  }
  
  return { startDate, endDate, selectedMonthDate };
}

async function DashboardContent({ 
  selectedMonthDate, 
  startDate, 
  endDate 
}: { 
  selectedMonthDate: Date;
  startDate: Date;
  endDate: Date;
}) {
  // CRITICAL: Load only critical data for first render
  const criticalData = await loadDashboardData(selectedMonthDate, startDate, endDate);

  // Load secondary data in parallel (non-blocking via Suspense)
  // This will be handled by a separate component wrapped in Suspense
  const { SecondaryDataLoader } = await import("./secondary-data-loader");

  return (
    <>
    <FinancialOverviewPage
        selectedMonthTransactions={criticalData.selectedMonthTransactions}
        lastMonthTransactions={criticalData.lastMonthTransactions}
        savings={criticalData.savings}
        totalBalance={criticalData.totalBalance}
        lastMonthTotalBalance={criticalData.lastMonthTotalBalance}
        accounts={criticalData.accounts}
        budgets={criticalData.budgets}
        upcomingTransactions={criticalData.upcomingTransactions}
        financialHealth={criticalData.financialHealth}
        goals={criticalData.goals}
        chartTransactions={criticalData.chartTransactions}
        liabilities={criticalData.liabilities}
        debts={criticalData.debts}
        recurringPayments={criticalData.recurringPayments}
        subscriptions={criticalData.subscriptions}
        plannedPayments={criticalData.plannedPayments}
        selectedMonthDate={selectedMonthDate}
        expectedIncomeRange={criticalData.expectedIncomeRange}
      />
      {/* Load secondary data via Suspense - won't block initial render */}
      <SecondaryDataLoader
      selectedMonthDate={selectedMonthDate}
        startDate={startDate}
        endDate={endDate}
    />
    </>
  );
}


export default async function Dashboard({ searchParams }: DashboardProps) {
  // Get selected range from URL or default to "this-month"
  // Access searchParams first (dynamic data) to unlock Date.now() usage
  const params = await Promise.resolve(searchParams);
  const rangeParam = params?.range as DateRange | undefined;
  const validRange: DateRange = rangeParam && ["this-month", "last-month", "last-60-days", "last-90-days"].includes(rangeParam)
    ? rangeParam
    : "this-month";
  
  // Calculate date range based on selection
  const { startDate, endDate, selectedMonthDate } = calculateDateRange(validRange);
  
  // Start performance tracking after accessing dynamic data
  const perf = startServerPagePerformance("Dashboard");
  
  // Get user profile to personalize the header
  const profileService = makeProfileService();
  const profile = await profileService.getProfile();
  const firstName = profile?.name?.split(' ')[0] || 'there';
  
  // Get onboarding decision and status in parallel for optimal performance
  let shouldShowOnboarding = false;
  let onboardingStatus: {
    hasPersonalData: boolean;
    hasExpectedIncome: boolean;
    hasPlan: boolean;
    completedCount: number;
    totalCount: number;
  } | undefined = undefined;
  
  try {
    const userId = await getCurrentUserId();
    if (userId) {
      // Use OnboardingDecisionService as single source of truth
      const decisionService = makeOnboardingDecisionService();
      const onboardingService = makeOnboardingService();
      const cookieStore = await cookies();
      const accessToken = cookieStore.get("sb-access-token")?.value;
      const refreshToken = cookieStore.get("sb-refresh-token")?.value;
      
      // Load decision and status in parallel
      const [shouldShow, status] = await Promise.all([
        decisionService.shouldShowOnboardingDialog(userId),
        onboardingService.getOnboardingStatus(
          userId,
          accessToken,
          refreshToken,
          { skipSubscriptionCheck: true } // Decision service already checked subscription
        ),
      ]);
      
      shouldShowOnboarding = shouldShow;
      onboardingStatus = {
        hasPersonalData: status.hasPersonalData,
        hasExpectedIncome: status.hasExpectedIncome,
        hasPlan: status.hasPlan,
        completedCount: status.completedCount,
        totalCount: status.totalCount,
      };
    }
  } catch (error) {
    // On error, default to showing onboarding (safer for user experience)
    console.warn("[Dashboard] Error getting onboarding decision:", error);
    shouldShowOnboarding = true;
  }
  
  perf.end();

  return (
    <div>
      {/* CRITICAL: Render onboarding dialog FIRST, before any other content */}
      {/* Pass decision and status from server - single source of truth */}
      <OnboardingDialogWrapper shouldShow={shouldShowOnboarding} initialStatus={onboardingStatus} />
      
      <Suspense fallback={null}>
        <UrlCleanup />
        <TrialCelebration />
      </Suspense>
      <DashboardRealtime />
      <DashboardUpdateChecker />
      <PageHeader
        title={`Welcome, ${firstName}`}
      >
        <DashboardHeaderActions />
      </PageHeader>

      <div className="w-full p-4 lg:p-8">
        <Suspense fallback={<DashboardSkeleton />}>
          <DashboardContent 
            selectedMonthDate={selectedMonthDate}
            startDate={startDate}
            endDate={endDate}
          />
        </Suspense>
      </div>
    </div>
  );
}

