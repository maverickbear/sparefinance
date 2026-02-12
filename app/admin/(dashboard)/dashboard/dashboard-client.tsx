"use client";

import { useRouter } from "next/navigation";
import { DashboardOverview } from "@/components/admin/dashboard-overview";
import { FinancialOverview } from "@/components/admin/financial-overview";
import { PlanDistributionChart } from "@/components/admin/plan-distribution-chart";
import { SubscriptionStatusChart } from "@/components/admin/subscription-status-chart";
import { MRRComparisonChart } from "@/components/admin/mrr-comparison-chart";
import { RevenueByPlanChart } from "@/components/admin/revenue-by-plan-chart";

interface DashboardClientProps {
  dashboardData: {
    overview: {
      totalUsers: number;
      usersWithoutSubscription: number;
      totalSubscriptions: number;
      activeSubscriptions: number;
      trialingSubscriptions: number;
      cancelledSubscriptions: number;
      pastDueSubscriptions: number;
      churnRisk: number;
    };
    financial: {
      mrr: number;
      estimatedFutureMRR: number;
      totalEstimatedMRR: number;
      subscriptionDetails: Array<{
        subscriptionId: string;
        userId: string;
        planId: string;
        planName: string;
        status: string;
        monthlyRevenue: number;
        interval: "month" | "year" | "unknown";
        trialEndDate: string | null;
      }>;
      upcomingTrials: Array<{
        subscriptionId: string;
        userId: string;
        planId: string;
        planName: string;
        trialEndDate: string;
        daysUntilEnd: number;
        estimatedMonthlyRevenue: number;
      }>;
    };
    planDistribution: Array<{
      planId: string;
      planName: string;
      activeCount: number;
      trialingCount: number;
      totalCount: number;
    }>;
  };
  systemSettings: {
    maintenanceMode: boolean;
  };
}

export function DashboardClient({ dashboardData, systemSettings }: DashboardClientProps) {
  const router = useRouter();

  return (
    <div className="space-y-8">
      <DashboardOverview
        overview={dashboardData.overview}
        loading={false}
        initialMaintenanceMode={systemSettings.maintenanceMode}
        onCardClick={(filterType) => {
          router.push(`/admin/users?filter=${filterType}`);
        }}
      />

      <div className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight">Financial Overview</h2>
        <p className="text-sm text-muted-foreground">
          Revenue metrics, MRR, and future revenue projections
        </p>
      </div>
      <FinancialOverview
        financial={dashboardData.financial}
        loading={false}
      />

      <div className="grid gap-6 md:grid-cols-2">
        <MRRComparisonChart data={dashboardData.financial} />
        <SubscriptionStatusChart
          data={{
            active: dashboardData.overview.activeSubscriptions,
            trialing: dashboardData.overview.trialingSubscriptions,
            cancelled: dashboardData.overview.cancelledSubscriptions,
            pastDue: dashboardData.overview.pastDueSubscriptions,
            churnRisk: dashboardData.overview.churnRisk,
          }}
        />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <PlanDistributionChart data={dashboardData.planDistribution} />
        <RevenueByPlanChart subscriptionDetails={dashboardData.financial.subscriptionDetails} />
      </div>
    </div>
  );
}
