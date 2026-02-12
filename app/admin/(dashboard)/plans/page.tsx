import { Suspense } from "react";
import { headers } from "next/headers";
import { makeAdminService } from "@/src/application/admin/admin.factory";
import { PlansPageClient } from "./plans-client";

async function PlansContent() {
  await headers();
  const adminService = makeAdminService();
  const plans = await adminService.getAllPlans();
  return <PlansPageClient initialPlans={plans} />;
}

export default function PlansPage() {
  return (
    <Suspense fallback={<div className="w-full p-4 lg:p-8">Loading...</div>}>
      <PlansContent />
    </Suspense>
  );
}
