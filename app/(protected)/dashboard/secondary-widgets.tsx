/**
 * Secondary Widgets Component
 * Loads non-critical dashboard data via Suspense streaming
 * This allows the dashboard to render quickly with critical data first
 */

import { loadSecondaryDashboardData } from "./data-loader";
import { getCurrentUserId } from "@/src/application/shared/feature-guard";
import { cookies } from "next/headers";

interface SecondaryWidgetsProps {
  selectedMonthDate: Date;
  startDate: Date;
  endDate: Date;
  onDataLoaded: (data: {
    lastMonthTransactions: any[];
    chartTransactions: any[];
    lastMonthTotalBalance: number;
    liabilities: any[];
    debts: any[];
    recurringPayments: any[];
    subscriptions: any[];
  }) => void;
}

/**
 * Secondary Widgets - Loads non-critical data for dashboard
 * This component is wrapped in Suspense to allow streaming
 */
export async function SecondaryWidgets({
  selectedMonthDate,
  startDate,
  endDate,
  onDataLoaded,
}: SecondaryWidgetsProps) {
  const userId = await getCurrentUserId();
  
  // Get session tokens
  let accessToken: string | undefined;
  let refreshToken: string | undefined;
  try {
    const cookieStore = await cookies();
    accessToken = cookieStore.get("sb-access-token")?.value;
    refreshToken = cookieStore.get("sb-refresh-token")?.value;
  } catch (error) {
    // Continue without tokens
  }

  // Load secondary data
  const secondaryData = await loadSecondaryDashboardData(
    selectedMonthDate,
    startDate,
    endDate,
    userId,
    accessToken,
    refreshToken
  );

  // Call callback to update parent component
  onDataLoaded(secondaryData);

  // This component doesn't render anything - it just loads data
  return null;
}

