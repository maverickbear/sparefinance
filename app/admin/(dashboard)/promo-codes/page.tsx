import { Suspense } from "react";
import { headers } from "next/headers";
import { makeAdminService } from "@/src/application/admin/admin.factory";
import { makeSubscriptionsService } from "@/src/application/subscriptions/subscriptions.factory";
import { PromoCodesPageClient } from "./promo-codes-client";

async function PromoCodesContent() {
  await headers();
  const adminService = makeAdminService();
  const [promoCodes, plans] = await Promise.all([
    adminService.getAllPromoCodes(),
    makeSubscriptionsService().getPlans(),
  ]);
  const availablePlans = plans.map((plan) => ({
    id: plan.id,
    name: plan.name,
  }));
  return <PromoCodesPageClient initialPromoCodes={promoCodes} availablePlans={availablePlans} />;
}

export default function PromoCodesPage() {
  return (
    <Suspense fallback={<div className="w-full p-4 lg:p-8">Loading...</div>}>
      <PromoCodesContent />
    </Suspense>
  );
}
