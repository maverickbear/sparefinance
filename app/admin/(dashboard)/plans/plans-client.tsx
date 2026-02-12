"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PlansTable } from "@/components/admin/plans-table";
import { PlanDialog } from "@/components/admin/plan-dialog";
import type { Plan } from "@/src/domain/subscriptions/subscriptions.validations";

interface PlansPageClientProps {
  initialPlans: Plan[];
}

export function PlansPageClient({ initialPlans }: PlansPageClientProps) {
  const router = useRouter();
  const [plans, setPlans] = useState<Plan[]>(initialPlans);
  const [isPlanDialogOpen, setIsPlanDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);

  function handleEditPlan(plan: Plan) {
    setEditingPlan(plan);
    setIsPlanDialogOpen(true);
  }

  function handleSuccess() {
    router.refresh();
  }

  return (
    <div className="w-full p-4 lg:p-8">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight">Subscription Plans</h2>
        <p className="text-sm text-muted-foreground">
          Manage plan features, limits, and pricing. Changes will be synced to Stripe if configured.
        </p>
      </div>
      <PlansTable
        plans={plans}
        loading={false}
        onEdit={handleEditPlan}
      />

      <PlanDialog
        open={isPlanDialogOpen}
        onOpenChange={(open) => {
          setIsPlanDialogOpen(open);
          if (!open) {
            setEditingPlan(null);
          }
        }}
        plan={editingPlan}
        onSuccess={handleSuccess}
      />
    </div>
  );
}
