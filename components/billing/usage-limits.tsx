"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlanFeatures } from "@/lib/validations/plan";
import { LimitCheckResult } from "@/lib/api/limits";
import { ArrowRight, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { usePricingModal } from "@/contexts/pricing-modal-context";

interface UsageLimitsProps {
  limits: PlanFeatures;
  transactionLimit: LimitCheckResult;
  accountLimit: LimitCheckResult;
}

export function UsageLimits({ limits, transactionLimit, accountLimit }: UsageLimitsProps) {
  const { openModal } = usePricingModal();
  
  const getProgress = (limit: LimitCheckResult) => {
    if (limit.limit === -1) return 0; // Unlimited
    return Math.min((limit.current / limit.limit) * 100, 100);
  };

  const formatLimit = (limit: number) => {
    if (limit === -1) return "Unlimited";
    return limit.toString();
  };

  const isAtLimit = (limit: LimitCheckResult) => {
    return limit.limit !== -1 && limit.current >= limit.limit;
  };

  const isNearLimit = (limit: LimitCheckResult) => {
    if (limit.limit === -1) return false;
    const percentage = (limit.current / limit.limit) * 100;
    return percentage >= 80;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Usage Limits</CardTitle>
        <CardDescription>Your current plan usage this month</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <div className="flex justify-between items-center text-sm">
            <span>Transactions</span>
            <div className="flex items-center gap-2">
              <span>
                {transactionLimit.current} / {formatLimit(transactionLimit.limit)}
              </span>
              {isAtLimit(transactionLimit) && (
                <Badge variant="destructive" className="text-xs">
                  <AlertCircle className="w-3 h-3 mr-1" />
                  Limit Reached
                </Badge>
              )}
              {isNearLimit(transactionLimit) && !isAtLimit(transactionLimit) && (
                <Badge variant="outline" className="text-xs border-yellow-500 text-yellow-700 dark:text-yellow-400">
                  Near Limit
                </Badge>
              )}
            </div>
          </div>
          {transactionLimit.limit !== -1 && (
            <div className="w-full bg-secondary rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all ${
                  isAtLimit(transactionLimit)
                    ? "bg-red-500"
                    : isNearLimit(transactionLimit)
                    ? "bg-yellow-500"
                    : "bg-primary"
                }`}
                style={{ width: `${getProgress(transactionLimit)}%` }}
              />
            </div>
          )}
          {transactionLimit.message && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">{transactionLimit.message}</p>
              {isAtLimit(transactionLimit) && (
                <Button onClick={openModal} variant="default">
                    Upgrade
                    <ArrowRight className="ml-1 w-3 h-3" />
                </Button>
              )}
            </div>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex justify-between items-center text-sm">
            <span>Accounts</span>
            <div className="flex items-center gap-2">
              <span>
                {accountLimit.current} / {formatLimit(accountLimit.limit)}
              </span>
              {isAtLimit(accountLimit) && (
                <Badge variant="destructive" className="text-xs">
                  <AlertCircle className="w-3 h-3 mr-1" />
                  Limit Reached
                </Badge>
              )}
              {isNearLimit(accountLimit) && !isAtLimit(accountLimit) && (
                <Badge variant="outline" className="text-xs border-yellow-500 text-yellow-700 dark:text-yellow-400">
                  Near Limit
                </Badge>
              )}
            </div>
          </div>
          {accountLimit.limit !== -1 && (
            <div className="w-full bg-secondary rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all ${
                  isAtLimit(accountLimit)
                    ? "bg-red-500"
                    : isNearLimit(accountLimit)
                    ? "bg-yellow-500"
                    : "bg-primary"
                }`}
                style={{ width: `${getProgress(accountLimit)}%` }}
              />
            </div>
          )}
          {accountLimit.message && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">{accountLimit.message}</p>
              {isAtLimit(accountLimit) && (
                <Button onClick={openModal} variant="default">
                    Upgrade
                    <ArrowRight className="ml-1 w-3 h-3" />
                </Button>
              )}
            </div>
          )}
        </div>

        <div className="space-y-2 text-sm border-t pt-4">
          <div className="flex justify-between items-center">
            <span>Investments</span>
            <div className="flex items-center gap-2">
              {limits.hasInvestments ? (
                <Badge variant="default" className="text-xs">Enabled</Badge>
              ) : (
                <>
                  <Badge variant="secondary" className="text-xs">Disabled</Badge>
                  <Button onClick={openModal} variant="default" size="small" className="text-xs">
                      Upgrade
                  </Button>
                </>
              )}
            </div>
          </div>
          <div className="flex justify-between items-center">
            <span>Advanced Reports</span>
            <div className="flex items-center gap-2">
              {limits.hasAdvancedReports ? (
                <Badge variant="default" className="text-xs">Enabled</Badge>
              ) : (
                <>
                  <Badge variant="secondary" className="text-xs">Disabled</Badge>
                  <Button onClick={openModal} variant="default" size="small" className="text-xs">
                      Upgrade
                  </Button>
                </>
              )}
            </div>
          </div>
          <div className="flex justify-between items-center">
            <span>CSV Export</span>
            <div className="flex items-center gap-2">
              {limits.hasCsvExport ? (
                <Badge variant="default" className="text-xs">Enabled</Badge>
              ) : (
                <>
                  <Badge variant="secondary" className="text-xs">Disabled</Badge>
                  <Button onClick={openModal} variant="default" size="small" className="text-xs">
                      Upgrade
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

