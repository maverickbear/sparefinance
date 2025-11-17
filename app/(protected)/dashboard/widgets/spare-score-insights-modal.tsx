"use client";

import { useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Lightbulb,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import { calculateTotalExpenses } from "../utils/transaction-helpers";
import type { FinancialHealthData } from "@/lib/api/financial-health";

interface SpareScoreInsightsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  financialHealth: FinancialHealthData | null;
  currentIncome: number;
  currentExpenses: number;
  emergencyFundMonths: number;
  selectedMonthTransactions: any[];
  lastMonthTransactions: any[];
}

export function SpareScoreInsightsModal({
  open,
  onOpenChange,
  financialHealth,
  currentIncome,
  currentExpenses,
  emergencyFundMonths,
  selectedMonthTransactions,
  lastMonthTransactions,
}: SpareScoreInsightsModalProps) {
  // Generate all alerts and insights
  const alerts = useMemo(() => {
    const alertsList: Array<{
      type: "success" | "warning" | "danger";
      badge: string;
      text: string;
      icon: React.ReactNode;
      category: "spending" | "debt" | "security";
    }> = [];

    // Savings rate alert
    const savingsRate = currentIncome > 0 ? ((currentIncome - currentExpenses) / currentIncome) * 100 : 0;
    if (savingsRate >= 15 && savingsRate < 22) {
      alertsList.push({
        type: "success",
        badge: "Savings",
        text: `You're saving ${savingsRate.toFixed(0)}% of your income. Increasing this to 22% would help you reach your goals faster.`,
        icon: <CheckCircle2 className="h-5 w-5" />,
        category: "spending",
      });
    }

    // Emergency fund alert
    if (emergencyFundMonths < 6) {
      const monthsNeeded = 6 - emergencyFundMonths;
      const monthlySavings = currentIncome - currentExpenses;
      const monthsToReach = monthlySavings > 0 ? Math.ceil((monthsNeeded * currentExpenses) / monthlySavings) : 0;
      
      alertsList.push({
        type: "warning",
        badge: "Emergency fund",
        text: `Your emergency fund covers ${emergencyFundMonths.toFixed(1)} months. Setting an automatic transfer of $${(monthlySavings * 0.1).toFixed(0) || 250}/month would get you to 6 months in about ${monthsToReach} months.`,
        icon: <AlertCircle className="h-5 w-5" />,
        category: "security",
      });
    }

    // Overspending alert
    const currentMonthExpenses = calculateTotalExpenses(selectedMonthTransactions);
    const lastMonthExpenses = calculateTotalExpenses(lastMonthTransactions);

    if (lastMonthExpenses > 0) {
      const expenseChange = ((currentMonthExpenses - lastMonthExpenses) / lastMonthExpenses) * 100;
      if (expenseChange > 20) {
        alertsList.push({
          type: "danger",
          badge: "Overspending",
          text: `Your spending is ${expenseChange.toFixed(0)}% higher than last month. Consider reviewing your budget categories.`,
          icon: <AlertTriangle className="h-5 w-5" />,
          category: "spending",
        });
      }
    }

    // Add alerts from financialHealth API
    if (financialHealth?.alerts) {
      financialHealth.alerts.forEach((alert) => {
        let type: "success" | "warning" | "danger" = "warning";
        let icon = <AlertCircle className="h-5 w-5" />;
        let category: "spending" | "debt" | "security" = "spending";

        if (alert.severity === "critical") {
          type = "danger";
          icon = <AlertTriangle className="h-5 w-5" />;
        } else if (alert.severity === "info") {
          type = "success";
          icon = <CheckCircle2 className="h-5 w-5" />;
        }

        // Categorize based on alert content
        if (alert.id.includes("debt") || alert.id.includes("dti")) {
          category = "debt";
        } else if (alert.id.includes("emergency") || alert.id.includes("security")) {
          category = "security";
        }

        alertsList.push({
          type,
          badge: alert.title,
          text: `${alert.description} ${alert.action ? `Action: ${alert.action}` : ""}`,
          icon,
          category,
        });
      });
    }

    return alertsList;
  }, [
    currentIncome,
    currentExpenses,
    emergencyFundMonths,
    selectedMonthTransactions,
    lastMonthTransactions,
    financialHealth,
  ]);

  // Get suggestions from financialHealth
  const suggestions = financialHealth?.suggestions || [];

  // Group alerts by category
  const spendingAlerts = alerts.filter((a) => a.category === "spending");
  const debtAlerts = alerts.filter((a) => a.category === "debt");
  const securityAlerts = alerts.filter((a) => a.category === "security");

  const getCategoryTitle = (category: string) => {
    switch (category) {
      case "spending":
        return "Spending Actions";
      case "debt":
        return "Debt Actions";
      case "security":
        return "Security Actions";
      default:
        return "Actions";
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "spending":
        return <TrendingDown className="h-4 w-4" />;
      case "debt":
        return <AlertCircle className="h-4 w-4" />;
      case "security":
        return <TrendingUp className="h-4 w-4" />;
      default:
        return <Lightbulb className="h-4 w-4" />;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl sm:max-h-[90vh] overflow-y-auto">
        <DialogHeader className="px-6 pt-6">
          <DialogTitle className="text-2xl font-bold">Spare Score Insights & Actions</DialogTitle>
          <DialogDescription>
            Personalized insights and actionable steps to improve your financial health
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 px-6 pb-6">
          {/* Score Summary */}
          {financialHealth && (
            <div className="bg-muted/50 rounded-lg p-4 border">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm text-muted-foreground">Current Spare Score</p>
                  <p className="text-3xl font-bold mt-1">{financialHealth.score}</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {financialHealth.classification}
                  </p>
                </div>
                {financialHealth.message && (
                  <div className="text-right max-w-[60%]">
                    <p className="text-sm text-foreground">{financialHealth.message}</p>
                  </div>
                )}
              </div>
              
              {/* Metrics */}
              <div className="grid grid-cols-3 gap-4 pt-4 border-t border-border">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Spending discipline</p>
                  <p className={cn(
                    "text-sm font-semibold",
                    financialHealth.spendingDiscipline === "Excellent" ? "text-green-500" :
                    financialHealth.spendingDiscipline === "Good" ? "text-green-600" :
                    financialHealth.spendingDiscipline === "Fair" ? "text-yellow-500" :
                    financialHealth.spendingDiscipline === "Poor" ? "text-orange-500" :
                    financialHealth.spendingDiscipline === "Critical" ? "text-red-500" : "text-muted-foreground"
                  )}>
                    {financialHealth.spendingDiscipline}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Debt exposure</p>
                  <p className={cn(
                    "text-sm font-semibold",
                    financialHealth.debtExposure === "Low" ? "text-green-500" :
                    financialHealth.debtExposure === "Moderate" ? "text-yellow-500" : "text-red-500"
                  )}>
                    {financialHealth.debtExposure}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Emergency fund</p>
                  <p className="text-sm font-semibold text-foreground">
                    {emergencyFundMonths.toFixed(1)} months
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Spending Actions */}
          {spendingAlerts.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                {getCategoryIcon("spending")}
                <h3 className="font-semibold text-lg">{getCategoryTitle("spending")}</h3>
              </div>
              <div className="space-y-2">
                {spendingAlerts.map((alert, index) => (
                  <div
                    key={index}
                    className={cn(
                      "p-3 rounded-lg border",
                      alert.type === "success" && "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800",
                      alert.type === "warning" && "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800",
                      alert.type === "danger" && "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div className={cn(
                        "flex-shrink-0 mt-0.5",
                        alert.type === "success" && "text-green-600 dark:text-green-400",
                        alert.type === "warning" && "text-amber-600 dark:text-amber-400",
                        alert.type === "danger" && "text-red-600 dark:text-red-400"
                      )}>
                        {alert.icon}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span
                            className={cn(
                              "inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium",
                              alert.type === "success" &&
                                "bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-200",
                              alert.type === "warning" &&
                                "bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-200",
                              alert.type === "danger" &&
                                "bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-200"
                            )}
                          >
                            {alert.badge}
                          </span>
                        </div>
                        <p className="text-sm leading-relaxed text-foreground">{alert.text}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Debt Actions */}
          {debtAlerts.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                {getCategoryIcon("debt")}
                <h3 className="font-semibold text-lg">{getCategoryTitle("debt")}</h3>
              </div>
              <div className="space-y-2">
                {debtAlerts.map((alert, index) => (
                  <div
                    key={index}
                    className={cn(
                      "p-3 rounded-lg border",
                      alert.type === "success" && "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800",
                      alert.type === "warning" && "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800",
                      alert.type === "danger" && "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div className={cn(
                        "flex-shrink-0 mt-0.5",
                        alert.type === "success" && "text-green-600 dark:text-green-400",
                        alert.type === "warning" && "text-amber-600 dark:text-amber-400",
                        alert.type === "danger" && "text-red-600 dark:text-red-400"
                      )}>
                        {alert.icon}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span
                            className={cn(
                              "inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium",
                              alert.type === "success" &&
                                "bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-200",
                              alert.type === "warning" &&
                                "bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-200",
                              alert.type === "danger" &&
                                "bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-200"
                            )}
                          >
                            {alert.badge}
                          </span>
                        </div>
                        <p className="text-sm leading-relaxed text-foreground">{alert.text}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Security Actions */}
          {securityAlerts.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                {getCategoryIcon("security")}
                <h3 className="font-semibold text-lg">{getCategoryTitle("security")}</h3>
              </div>
              <div className="space-y-2">
                {securityAlerts.map((alert, index) => (
                  <div
                    key={index}
                    className={cn(
                      "p-3 rounded-lg border",
                      alert.type === "success" && "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800",
                      alert.type === "warning" && "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800",
                      alert.type === "danger" && "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div className={cn(
                        "flex-shrink-0 mt-0.5",
                        alert.type === "success" && "text-green-600 dark:text-green-400",
                        alert.type === "warning" && "text-amber-600 dark:text-amber-400",
                        alert.type === "danger" && "text-red-600 dark:text-red-400"
                      )}>
                        {alert.icon}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span
                            className={cn(
                              "inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium",
                              alert.type === "success" &&
                                "bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-200",
                              alert.type === "warning" &&
                                "bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-200",
                              alert.type === "danger" &&
                                "bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-200"
                            )}
                          >
                            {alert.badge}
                          </span>
                        </div>
                        <p className="text-sm leading-relaxed text-foreground">{alert.text}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Suggestions */}
          {suggestions.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Lightbulb className="h-4 w-4" />
                <h3 className="font-semibold text-lg">Recommendations</h3>
              </div>
              <div className="space-y-2">
                {suggestions.map((suggestion, index) => (
                  <div
                    key={suggestion.id || index}
                    className="p-3 rounded-lg border bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800"
                  >
                    <div className="flex items-start gap-3">
                      <Lightbulb className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-200">
                            {suggestion.impact === "high" ? "High Impact" : suggestion.impact === "medium" ? "Medium Impact" : "Low Impact"}
                          </span>
                        </div>
                        <h4 className="font-medium text-sm mb-1">{suggestion.title}</h4>
                        <p className="text-sm text-muted-foreground">{suggestion.description}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* No alerts or suggestions */}
          {alerts.length === 0 && suggestions.length === 0 && (
            <div className="text-center py-8">
              <CheckCircle2 className="h-12 w-12 text-green-600 dark:text-green-400 mx-auto mb-3" />
              <p className="text-sm font-medium">Great job!</p>
              <p className="text-sm text-muted-foreground mt-1">
                Your Spare Score looks good. Keep up the excellent work!
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

