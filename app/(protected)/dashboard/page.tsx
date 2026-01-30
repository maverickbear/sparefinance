import { Suspense } from "react";
import { makeOnboardingDecisionService } from "@/src/application/onboarding/onboarding.factory";
import { makeOnboardingService } from "@/src/application/onboarding/onboarding.factory";
import { getCurrentUserId } from "@/src/application/shared/feature-guard";
import { DashboardRealtime } from "@/components/dashboard/dashboard-realtime";
import { DashboardUpdateChecker } from "@/components/dashboard/dashboard-update-checker";
import { TrialCelebration } from "@/components/dashboard/trial-celebration";
import { UrlCleanup } from "@/components/common/url-cleanup";
import { PageHeader } from "@/components/common/page-header";
import { startServerPagePerformance } from "@/lib/utils/performance";
import { cookies } from "next/headers";
import { OnboardingDialogWrapper } from "@/src/presentation/components/features/onboarding/onboarding-dialog-wrapper";
import { DashboardWidgetsClient } from "@/src/presentation/components/features/dashboard/dashboard-widgets-client";

interface DashboardProps {
  searchParams: Promise<{ month?: string; range?: string }>;
}

export default async function Dashboard({ searchParams }: DashboardProps) {
  // Access searchParams to unlock Date.now() usage
  await searchParams;
  
  // Start performance tracking
  const perf = startServerPagePerformance("Dashboard");
  
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
        decisionService.shouldShowOnboardingDialog(userId, accessToken, refreshToken),
        onboardingService.getOnboardingStatus(
          userId,
          accessToken,
          refreshToken,
          { skipSubscriptionCheck: true } // Onboarding no longer depends on subscription
        ),
      ]);
      
      shouldShowOnboarding = shouldShow;
      onboardingStatus = {
        hasPersonalData: status.hasPersonalData,
        hasExpectedIncome: status.hasExpectedIncome,
        hasPlan: false, // No longer used for onboarding decision, kept for backward compatibility
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

      <PageHeader title="Dashboard" />

      {/* Dashboard Widgets */}
      <Suspense fallback={
        <div className="w-full p-4 lg:p-8">
          <div className="space-y-6">
            <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-64 bg-muted rounded-lg animate-pulse" />
              ))}
            </div>
          </div>
        </div>
      }>
        <DashboardWidgetsClient />
      </Suspense>
    </div>
  );
}

