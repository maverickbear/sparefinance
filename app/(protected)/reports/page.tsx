import { Suspense } from "react";
import { loadReportsData } from "./data-loader";
import { PageHeader } from "@/components/common/page-header";
import { ReportFilters } from "@/components/reports/report-filters";
import { ReportsContent } from "./reports-content";
import { startServerPagePerformance } from "@/lib/utils/performance";
import { getCurrentUserSubscriptionData } from "@/lib/api/subscription";
import { Loader2 } from "lucide-react";
import type { ReportPeriod } from "@/components/reports/report-filters";
import { startOfMonth, endOfMonth, subMonths } from "date-fns";
import { FixedTabsWrapper } from "@/components/common/fixed-tabs-wrapper";
import { SimpleTabs, SimpleTabsList, SimpleTabsTrigger } from "@/components/ui/simple-tabs";
import { BlockedFeature } from "@/components/common/blocked-feature";

// Force dynamic rendering since this page uses cookies for authentication
export const dynamic = 'force-dynamic';

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
  // PERFORMANCE: Get subscription data once and pass to both loadReportsData and ReportsContent
  // This avoids duplicate getCurrentUserSubscriptionData() call
  const subscriptionData = await getCurrentUserSubscriptionData();
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
      debts={data.debts}
      goals={data.goals}
      financialHealth={data.financialHealth}
      accounts={data.accounts}
      portfolioSummary={data.portfolioSummary}
      portfolioHoldings={data.portfolioHoldings}
      portfolioHistorical={data.portfolioHistorical}
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
  const perf = startServerPagePerformance("Reports");
  
  // Get period from URL or use default
  const params = await Promise.resolve(searchParams);
  const periodParam = params?.period;
  const period: ReportPeriod = (periodParam && 
    ["current-month", "last-3-months", "last-6-months", "last-12-months", "year-to-date", "custom"].includes(periodParam)
  ) ? periodParam as ReportPeriod : "last-12-months";
  
  // Check feature access on server side
  const subscriptionData = await getCurrentUserSubscriptionData();
  const { limits, plan } = subscriptionData;
  
  // Use centralized feature checking service
  const { hasFeatureAccess } = await import("@/lib/api/plan-features-service");
  const hasAdvancedReports = hasFeatureAccess(limits, "hasAdvancedReports");
  
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
    const { createServerClient } = await import("@/lib/supabase-server");
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: userData } = await supabase
        .from("User")
        .select("role")
        .eq("id", user.id)
        .single();
      isSuperAdmin = userData?.role === "super_admin";
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
