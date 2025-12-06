import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { getCurrentUserId } from "@/src/application/shared/feature-guard";
import { redirect } from "next/navigation";
import { makeAdminService } from "@/src/application/admin/admin.factory";
import { makeTaxRatesService } from "@/src/application/taxes/tax-rates.factory";
import { TaxRatesPageClient } from "./tax-rates-client";

async function TaxRatesContent() {
  const userId = await getCurrentUserId();
  
  if (!userId) {
    redirect("/auth/login");
  }

  const adminService = makeAdminService();
  
  // Check if user is super_admin
  if (!(await adminService.isSuperAdmin(userId))) {
    redirect("/dashboard");
  }

  // Fetch initial tax rates using service
  const taxRatesService = makeTaxRatesService();
  const initialRates = await taxRatesService.getAll();

  return <TaxRatesPageClient initialRates={initialRates} />;
}

function LoadingFallback() {
  return (
    <div className="flex items-center justify-center py-8">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}

export default function TaxRatesPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <TaxRatesContent />
    </Suspense>
  );
}

