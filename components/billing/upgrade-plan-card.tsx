"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Flame } from "lucide-react";
import { UpgradePlanModal } from "@/components/billing/upgrade-plan-modal";
import { Plan } from "@/lib/validations/plan";

interface UpgradePlanCardProps {
  currentPlan?: string;
  currentPlanId?: string;
  onUpgradeSuccess?: () => void;
}

export function UpgradePlanCard({ 
  currentPlan, 
  currentPlanId,
  onUpgradeSuccess 
}: UpgradePlanCardProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [plans, setPlans] = useState<Plan[]>([]);

  // Preload plans when component mounts
  useEffect(() => {
    async function loadPlans() {
      try {
        const response = await fetch("/api/billing/plans");
        if (response.ok) {
          const data = await response.json();
          setPlans(data.plans);
        }
      } catch (error) {
        console.error("Error preloading plans:", error);
      }
    }
    loadPlans();
  }, []);

  // Don't show upgrade card if user is already on premium plan
  if (currentPlan === "premium") {
    return null;
  }

  return (
    <>
      <Card className="bg-gradient-to-r from-primary to-primary/90 border-primary">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-white/10 rounded-lg">
                <Flame className="h-6 w-6 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Upgrade Plan</h3>
                <p className="text-sm text-white/90">
                  Unlock unlimited transactions, advanced analytics, priority support and 50% off
                </p>
              </div>
            </div>
            <Button
              onClick={() => setModalOpen(true)}
              variant="secondary"
              className="bg-white text-primary hover:bg-white/90"
            >
              Upgrade
            </Button>
          </div>
        </CardContent>
      </Card>

      <UpgradePlanModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        currentPlanId={currentPlanId}
        onSuccess={onUpgradeSuccess}
        preloadedPlans={plans}
      />
    </>
  );
}

