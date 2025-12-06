import { Suspense } from "react";
import { loadReportsData } from "./data-loader";
import { PageHeader } from "@/components/common/page-header";
import { ReportFilters } from "@/components/reports/report-filters";
import { ReportsContent } from "./reports-content";
import { startServerPagePerformance } from "@/lib/utils/performance";
import { Loader2 } from "lucide-react";
import type { ReportPeriod } from "@/components/reports/report-filters";
import { startOfMonth, endOfMonth, subMonths } from "date-fns";
import { FixedTabsWrapper } from "@/components/common/fixed-tabs-wrapper";
import { SimpleTabs, SimpleTabsList, SimpleTabsTrigger } from "@/components/ui/simple-tabs";
import { BlockedFeature } from "@/components/common/blocked-feature";
// CRITICAL: Use static import to ensure React cache() works correctly
import { getDashboardSubscription } from "@/src/application/subscriptions/get-dashboard-subscription";

function getDateRange(period: ReportPeriod): { startDate: Date; endDate: Date } {
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
}

async function ReportsContentWrapper({ period }: { period: ReportPeriod }) {
  // CRITICAL OPTIMIZATION: Use cached getDashboardSubscription to avoid duplicate calls
  // Using static import ensures React cache() works correctly
  const subscriptionData = await getDashboardSubscription();
  const { limits } = subscriptionData;
  
  const data = await loadReportsData(period);
  const now = new Date();
  const dateRange = getDateRange(period);

  return (
    <ReportsContent
      limits={limits}
      budgets={data.budgets}
      currentMonthTransactions={data.currentMonthTransactions}
      historicalTransactions={data.historicalTransactions}
      debts={data.debts as any}
      goals={data.goals as any}
      financialHealth={data.financialHealth}
      accounts={data.accounts}
      portfolioSummary={data.portfolioSummary}
      portfolioHoldings={data.portfolioHoldings}
      portfolioHistorical={data.portfolioHistorical}
      netWorth={data.netWorth}
      cashFlow={data.cashFlow}
      trends={data.trends}
      now={now}
      period={period}
      dateRange={dateRange}
    />
  );
}

interface ReportsProps {
  searchParams: Promise<{ period?: string }>;
}

export default async function ReportsPage({ searchParams }: ReportsProps) {
  // Get period from URL or use default (access uncached data first)
  const params = await Promise.resolve(searchParams);
  const periodParam = params?.period;
  const period: ReportPeriod = (periodParam && 
    ["current-month", "last-3-months", "last-6-months", "last-12-months", "year-to-date", "custom"].includes(periodParam)
  ) ? periodParam as ReportPeriod : "last-12-months";
  
  // Check feature access on server side
  // CRITICAL: Use cached getDashboardSubscription to avoid duplicate calls
  const { makeAdminService } = await import("@/src/application/admin/admin.factory");
  const adminService = makeAdminService();
  
  // Use cached function instead of direct service call
  const subscriptionData = await getDashboardSubscription();
  
  // Now we can safely use Date.now() after accessing uncached data
  const perf = startServerPagePerformance("Reports");
  const { limits, plan } = subscriptionData;
  
  // Check feature access directly from limits (limits already contains the features)
  const hasAdvancedReports = limits.hasAdvancedReports || false;
  
  // Debug: Log what we're getting from the database
  const logger = (await import("@/lib/utils/logger")).logger;
  const log = logger.withPrefix("REPORTS-PAGE");
  log.debug("Feature check:", {
    planId: plan?.id,
    planName: plan?.name,
    hasAdvancedReports,
    limitsHasAdvancedReports: limits.hasAdvancedReports,
    limitsHasAdvancedReportsType: typeof limits.hasAdvancedReports,
    allLimits: JSON.stringify(limits),
    planFeatures: plan?.features ? JSON.stringify(plan.features) : "null",
  });
  
  // Check if user is super_admin
  let isSuperAdmin = false;
  try {
    const { getCurrentUserId } = await import("@/src/application/shared/feature-guard");
    const userId = await getCurrentUserId();
    if (userId) {
      isSuperAdmin = await adminService.isSuperAdmin(userId);
    }
  } catch (error) {
    // If error checking, assume not super_admin
  }
  
  log.debug("Access check result:", {
    hasAdvancedReports,
    isSuperAdmin,
    willBlock: !hasAdvancedReports && !isSuperAdmin,
  });
  
  perf.end();

  return (
    <div>
      {/* Show only title when blocked, full header when not blocked */}
      {!hasAdvancedReports && !isSuperAdmin ? (
        <PageHeader title="Reports" />
      ) : (
      <PageHeader
        title="Reports"
      >
        <ReportFilters period={period} />
      </PageHeader>
      )}

      {/* If user doesn't have access and is not super_admin, show blocked screen with promotion */}
      {!hasAdvancedReports && !isSuperAdmin ? (
        <BlockedFeature feature="hasAdvancedReports" featureName="Advanced Reports" />
      ) : (
      <SimpleTabs defaultValue="overview" className="w-full">
        {/* Fixed Tabs - Desktop only */}
        <FixedTabsWrapper>
          <SimpleTabsList className="flex-wrap">
            <SimpleTabsTrigger value="overview">Overview</SimpleTabsTrigger>
            <SimpleTabsTrigger value="net-worth">Net Worth</SimpleTabsTrigger>
            <SimpleTabsTrigger value="income-expenses">Income & Expenses</SimpleTabsTrigger>
            <SimpleTabsTrigger value="investments">Investments</SimpleTabsTrigger>
            <SimpleTabsTrigger value="debts">Debts</SimpleTabsTrigger>
            <SimpleTabsTrigger value="goals">Goals</SimpleTabsTrigger>
            <SimpleTabsTrigger value="accounts">Accounts</SimpleTabsTrigger>
            <SimpleTabsTrigger value="insights">Insights</SimpleTabsTrigger>
          </SimpleTabsList>
        </FixedTabsWrapper>

        {/* Mobile/Tablet Tabs - Sticky at top */}
        <div 
          className="lg:hidden sticky top-0 z-40 bg-card dark:bg-transparent border-b"
        >
          <div 
            className="overflow-x-auto scrollbar-hide" 
            style={{ 
              WebkitOverflowScrolling: 'touch',
              scrollSnapType: 'x mandatory',
              touchAction: 'pan-x',
            }}
          >
            <SimpleTabsList className="min-w-max px-4" style={{ scrollSnapAlign: 'start' }}>
              <SimpleTabsTrigger value="overview" className="flex-shrink-0 whitespace-nowrap">
                Overview
              </SimpleTabsTrigger>
              <SimpleTabsTrigger value="net-worth" className="flex-shrink-0 whitespace-nowrap">
                Net Worth
              </SimpleTabsTrigger>
              <SimpleTabsTrigger value="income-expenses" className="flex-shrink-0 whitespace-nowrap">
                Income & Expenses
              </SimpleTabsTrigger>
              <SimpleTabsTrigger value="investments" className="flex-shrink-0 whitespace-nowrap">
                Investments
              </SimpleTabsTrigger>
              <SimpleTabsTrigger value="debts" className="flex-shrink-0 whitespace-nowrap">
                Debts
              </SimpleTabsTrigger>
              <SimpleTabsTrigger value="goals" className="flex-shrink-0 whitespace-nowrap">
                Goals
              </SimpleTabsTrigger>
              <SimpleTabsTrigger value="accounts" className="flex-shrink-0 whitespace-nowrap">
                Accounts
              </SimpleTabsTrigger>
              <SimpleTabsTrigger value="insights" className="flex-shrink-0 whitespace-nowrap">
                Insights
              </SimpleTabsTrigger>
            </SimpleTabsList>
          </div>
        </div>

        <div className="w-full p-4 lg:p-8">
          <Suspense fallback={
            <div className="flex items-center justify-center min-h-[400px]">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          }>
            <ReportsContentWrapper period={period} />
          </Suspense>
        </div>
      </SimpleTabs>
      )}
    </div>
  );
}
