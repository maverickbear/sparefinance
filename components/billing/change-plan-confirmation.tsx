"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Plan } from "@/src/domain/subscriptions/subscriptions.validations";
import { AlertTriangle, Check, X } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface ChangePlanConfirmationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentPlan: Plan | null;
  targetPlan: Plan;
  onConfirm: () => void;
  loading?: boolean;
  isDowngrade?: boolean;
  isUpgrade?: boolean;
  isCancellation?: boolean;
  onOpenStripePortal?: () => void;
}

export function ChangePlanConfirmationModal({
  open,
  onOpenChange,
  currentPlan,
  targetPlan,
  onConfirm,
  loading = false,
  isDowngrade = false,
  isUpgrade = false,
  isCancellation = false,
  onOpenStripePortal,
}: ChangePlanConfirmationModalProps) {
  // Get features that will be lost (for downgrades)
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

    // Check debts
    if (current.features.hasDebts && !target.features.hasDebts) {
      lostFeatures.push("Debt tracking");
    }

    // Check goals
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

  // Get features that will be gained (for upgrades)
  function getGainedFeatures(current: Plan, target: Plan): string[] {
    const gainedFeatures: string[] = [];

    // Check transactions
    if (current.features.maxTransactions !== -1 && target.features.maxTransactions === -1) {
      gainedFeatures.push("Unlimited transactions");
    } else if (current.features.maxTransactions < target.features.maxTransactions) {
      gainedFeatures.push(`${target.features.maxTransactions} transactions/month (up from ${current.features.maxTransactions})`);
    }

    // Check accounts
    if (current.features.maxAccounts !== -1 && target.features.maxAccounts === -1) {
      gainedFeatures.push("Unlimited accounts");
    } else if (current.features.maxAccounts < target.features.maxAccounts) {
      gainedFeatures.push(`${target.features.maxAccounts} accounts (up from ${current.features.maxAccounts})`);
    }

    // Check investments
    if (!current.features.hasInvestments && target.features.hasInvestments) {
      gainedFeatures.push("Investment tracking");
    }

    // Check advanced reports
    if (!current.features.hasAdvancedReports && target.features.hasAdvancedReports) {
      gainedFeatures.push("Advanced reports");
    }

    // Check CSV export
    if (!current.features.hasCsvExport && target.features.hasCsvExport) {
      gainedFeatures.push("CSV export");
    }

    // Check CSV import
    if (!current.features.hasCsvImport && target.features.hasCsvImport) {
      gainedFeatures.push("CSV import");
    }

    // Check budgets
    if (!current.features.hasBudgets && target.features.hasBudgets) {
      gainedFeatures.push("Budgets");
    }

    // Check bank integration
    if (!current.features.hasBankIntegration && target.features.hasBankIntegration) {
      gainedFeatures.push("Bank account integration");
    }

    return gainedFeatures;
  }

  if (isCancellation) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-2xl sm:max-h-[90vh] flex flex-col !p-0 !gap-0">
          <DialogHeader>
            <DialogTitle className="text-2xl flex items-center gap-2">
              <AlertTriangle className="h-6 w-6 text-yellow-500" />
              Cancel Subscription
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to cancel your subscription?
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>Warning:</strong> Cancelling your subscription will end your access to all plan features at the end of your current billing period.
              </AlertDescription>
            </Alert>

            {currentPlan && (
              <div>
                <h3 className="font-semibold mb-2">You will lose access to:</h3>
                <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                  {currentPlan.features.maxTransactions > 0 && (
                    <li>{currentPlan.features.maxTransactions} transactions/month</li>
                  )}
                  {currentPlan.features.maxAccounts > 0 && (
                    <li>{currentPlan.features.maxAccounts} accounts</li>
                  )}
                  {currentPlan.features.hasInvestments && <li>Investment tracking</li>}
                  {currentPlan.features.hasAdvancedReports && <li>Advanced reports</li>}
                  {currentPlan.features.hasCsvExport && <li>CSV export</li>}
                  {currentPlan.features.hasCsvImport && <li>CSV import</li>}
                  {currentPlan.features.hasBudgets && <li>Budgets</li>}
                  {currentPlan.features.hasHousehold && <li>Household members</li>}
                </ul>
              </div>
            )}

            <Alert>
              <AlertDescription>
                <strong>Note:</strong> You will continue to have access to your current plan features until the end of your billing period.
              </AlertDescription>
            </Alert>
          </div>

          <DialogFooter className="flex-shrink-0">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
              className="flex-1 sm:flex-initial"
            >
              Keep Subscription
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (onOpenStripePortal) {
                  onOpenStripePortal();
                  onOpenChange(false);
                } else {
                  onConfirm();
                }
              }}
              disabled={loading}
              className="flex-1 sm:flex-initial"
            >
              {loading ? "Processing..." : "Cancel Subscription"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  if (!currentPlan) {
    return null;
  }

  const lostFeatures = isDowngrade ? getLostFeatures(currentPlan, targetPlan) : [];
  const gainedFeatures = isUpgrade ? getGainedFeatures(currentPlan, targetPlan) : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl sm:max-h-[90vh] flex flex-col !p-0 !gap-0">
        <DialogHeader>
          <DialogTitle className="text-2xl flex items-center gap-2">
            {isDowngrade ? (
              <AlertTriangle className="h-6 w-6 text-yellow-500" />
            ) : (
              <Check className="h-6 w-6 text-green-500" />
            )}
            {isDowngrade ? "Confirm Downgrade" : "Confirm Upgrade"}
          </DialogTitle>
        </DialogHeader>
        <div className="px-6 pb-4">
          <DialogDescription>
            You are about to {isDowngrade ? "downgrade" : "upgrade"} from{" "}
            {currentPlan.name.charAt(0).toUpperCase() + currentPlan.name.slice(1)} to{" "}
            {targetPlan.name.charAt(0).toUpperCase() + targetPlan.name.slice(1)} plan.
          </DialogDescription>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
          {isDowngrade && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>Important:</strong> You will lose access to the following features when you downgrade:
              </AlertDescription>
            </Alert>
          )}

          {isUpgrade && (
            <Alert>
              <Check className="h-4 w-4" />
              <AlertDescription>
                <strong>Great choice!</strong> You will gain access to the following features:
              </AlertDescription>
            </Alert>
          )}

          {isDowngrade && lostFeatures.length > 0 && (
            <div>
              <h3 className="font-semibold mb-2">Features you will lose:</h3>
              <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                {lostFeatures.map((feature, index) => (
                  <li key={index}>{feature}</li>
                ))}
              </ul>
            </div>
          )}

          {isUpgrade && gainedFeatures.length > 0 && (
            <div>
              <h3 className="font-semibold mb-2">Features you will gain:</h3>
              <ul className="list-disc list-inside space-y-1 text-sm text-green-600 dark:text-green-400">
                {gainedFeatures.map((feature, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <Check className="h-4 w-4 flex-shrink-0 mt-0.5" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {isDowngrade ? (
            <Alert>
              <AlertDescription>
                <strong>Note:</strong> Your plan change will take effect at the end of the current billing period. 
                You will continue to have access to your current plan features until then.
              </AlertDescription>
            </Alert>
          ) : (
            <Alert>
              <AlertDescription>
                <strong>Note:</strong> Your upgrade will take effect immediately. You will be charged a prorated amount for the remainder of your billing period.
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter className="flex-shrink-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
            className="flex-1 sm:flex-initial"
          >
            Cancel
          </Button>
          <Button
            variant={isDowngrade ? "destructive" : "default"}
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 sm:flex-initial"
          >
            {loading ? "Processing..." : isDowngrade ? "Confirm Downgrade" : "Confirm Upgrade"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

