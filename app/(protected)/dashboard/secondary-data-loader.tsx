/**
 * Secondary Data Loader Component
 * Loads non-critical dashboard data and updates the page via client-side state
 * Wrapped in Suspense to allow streaming
 */

import { Suspense } from "react";
import { loadSecondaryDashboardData } from "./data-loader";
import { getCurrentUserId } from "@/src/application/shared/feature-guard";
import { cookies } from "next/headers";

interface SecondaryDataLoaderProps {
  selectedMonthDate: Date;
  startDate: Date;
  endDate: Date;
}

async function SecondaryDataContent({
  selectedMonthDate,
  startDate,
  endDate,
}: SecondaryDataLoaderProps) {
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

  // This component doesn't render anything visible
  // The data will be used by the parent component via a different mechanism
  // For now, we'll use a script tag to pass data to client
  return (
    <script
      dangerouslySetInnerHTML={{
        __html: `window.__SECONDARY_DASHBOARD_DATA__ = ${JSON.stringify(secondaryData)};`,
      }}
    />
  );
}

export function SecondaryDataLoader(props: SecondaryDataLoaderProps) {
  return (
    <Suspense fallback={null}>
      <SecondaryDataContent {...props} />
    </Suspense>
  );
}

