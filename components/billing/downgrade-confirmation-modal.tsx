"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Plan } from "@/src/domain/subscriptions/subscriptions.validations";
import { AlertTriangle, X } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface DowngradeConfirmationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentPlan: Plan;
  targetPlan: Plan;
  onConfirm: () => void;
  loading?: boolean;
}

export function DowngradeConfirmationModal({
  open,
  onOpenChange,
  currentPlan,
  targetPlan,
  onConfirm,
  loading = false,
}: DowngradeConfirmationModalProps) {
  // Get features that will be lost
  function getLostFeatures(current: Plan, target: Plan): string[] {
    const lostFeatures: string[] = [];

    // Check transactions
    if (current.features.maxTransactions === -1 && target.features.maxTransactions !== -1) {
      lostFeatures.push("Unlimited transactions");
    } else if (current.features.maxTransactions > target.features.maxTransactions) {
      lostFeatures.push(`${current.features.maxTransactions} transactions/month (will be reduced to ${target.features.maxTransactions})`);
    }

    // Check accounts
    if (current.features.maxAccounts === -1 && target.features.maxAccounts !== -1) {
      lostFeatures.push("Unlimited accounts");
    } else if (current.features.maxAccounts > target.features.maxAccounts) {
      lostFeatures.push(`${current.features.maxAccounts} accounts (will be reduced to ${target.features.maxAccounts})`);
    }

    // Check investments
    if (current.features.hasInvestments && !target.features.hasInvestments) {
      lostFeatures.push("Investment tracking");
    }

    // Check advanced reports
    if (current.features.hasAdvancedReports && !target.features.hasAdvancedReports) {
      lostFeatures.push("Advanced reports");
    }

    // Check CSV export
    if (current.features.hasCsvExport && !target.features.hasCsvExport) {
      lostFeatures.push("CSV export");
    }

    // Check CSV import
    if (current.features.hasCsvImport && !target.features.hasCsvImport) {
      lostFeatures.push("CSV import");
    }

    // Check debts (usually all plans have this, but check anyway)
    if (current.features.hasDebts && !target.features.hasDebts) {
      lostFeatures.push("Debt tracking");
    }

    // Check goals (usually all plans have this, but check anyway)
    if (current.features.hasGoals && !target.features.hasGoals) {
      lostFeatures.push("Goals tracking");
    }

    // Check budgets
    if (current.features.hasBudgets && !target.features.hasBudgets) {
      lostFeatures.push("Budgets");
    }

    // Check household members
    if (current.features.hasHousehold && !target.features.hasHousehold) {
      lostFeatures.push("Household members");
    }

    // Check bank integration
    if (current.features.hasBankIntegration && !target.features.hasBankIntegration) {
      lostFeatures.push("Bank account integration");
    }

    return lostFeatures;
  }

  const lostFeatures = getLostFeatures(currentPlan, targetPlan);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-2xl flex items-center gap-2">
            <AlertTriangle className="h-6 w-6 text-yellow-500" />
            Confirm Downgrade
          </DialogTitle>
          <DialogDescription>
            You are about to downgrade from {currentPlan.name.charAt(0).toUpperCase() + currentPlan.name.slice(1)} to {targetPlan.name.charAt(0).toUpperCase() + targetPlan.name.slice(1)} plan.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Important:</strong> You will lose access to the following features when you downgrade:
            </AlertDescription>
          </Alert>

          {lostFeatures.length > 0 ? (
            <div>
              <h3 className="font-semibold mb-2">Features you will lose:</h3>
              <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                {lostFeatures.map((feature, index) => (
                  <li key={index}>{feature}</li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No features will be lost with this downgrade.
            </p>
          )}

            <Alert>
              <AlertDescription>
                <strong>Note:</strong> Your current subscription will be cancelled and you will be redirected to Stripe 
                to subscribe to the {targetPlan.name.charAt(0).toUpperCase() + targetPlan.name.slice(1)} plan.
              </AlertDescription>
            </Alert>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? "Processing..." : "Confirm Downgrade"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

