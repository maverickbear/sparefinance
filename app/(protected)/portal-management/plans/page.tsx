"use client";

import { useState, useEffect } from "react";
import { PlansTable } from "@/components/admin/plans-table";
import { PlanDialog } from "@/components/admin/plan-dialog";
import type { Plan } from "@/src/domain/subscriptions/subscriptions.validations";

export default function PlansPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [isPlanDialogOpen, setIsPlanDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);

  useEffect(() => {
    loadAdminPlans();
  }, []);

  async function loadAdminPlans() {
    try {
      setLoadingPlans(true);
      const response = await fetch("/api/admin/plans");
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error || "Failed to load plans";
        console.error("Error loading plans:", errorMessage);
        setPlans([]);
        return;
      }
      const data = await response.json();
      setPlans(Array.isArray(data.plans) ? data.plans : []);
    } catch (error) {
      console.error("Error loading plans:", error);
      setPlans([]);
    } finally {
      setLoadingPlans(false);
    }
  }

  function handleEditPlan(plan: Plan) {
    setEditingPlan(plan);
    setIsPlanDialogOpen(true);
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
        loading={loadingPlans}
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
        onSuccess={async () => {
          // Reload plans to show updated data
          await loadAdminPlans();
        }}
      />
    </div>
  );
}

