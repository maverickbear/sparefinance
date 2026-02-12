import { Suspense } from "react";
import { headers } from "next/headers";
import { DashboardOverview } from "@/components/admin/dashboard-overview";
import { FinancialOverview } from "@/components/admin/financial-overview";
import { Loader2 } from "lucide-react";
import { makeAdminService } from "@/src/application/admin/admin.factory";
import { getVersionInfo } from "@/lib/utils/version";
import { DashboardClient } from "./dashboard-client";

async function DashboardContent() {
  // Access headers() first so Next.js opts into dynamic rendering before
  // createServiceRoleClient() (which uses Math.random() via Supabase auth).
  await headers();

  const adminService = makeAdminService();
  const [dashboardData, systemSettings, versionInfo] = await Promise.all([
    adminService.getDashboardData(),
    adminService.getSystemSettings(),
    Promise.resolve(getVersionInfo()),
  ]);

  return (
    <div className="w-full p-4 lg:p-8">
      <div className="space-y-6">
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold tracking-tight">
            System Overview
            {versionInfo.version && (
              <span className="ml-2 text-base font-normal text-muted-foreground">
                v{versionInfo.version}
              </span>
            )}
          </h2>
          <p className="text-sm text-muted-foreground">
            Key metrics and statistics about the platform
          </p>
        </div>
        <DashboardClient
          dashboardData={dashboardData}
          systemSettings={systemSettings}
        />
      </div>
    </div>
  );
}

function LoadingFallback() {
  return (
    <div className="w-full p-4 lg:p-8">
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <DashboardContent />
    </Suspense>
  );
}
