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
  ArrowRight,
  Shield,
  CreditCard,
  Wallet,
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
  // Helper function to parse date from Supabase format
  const parseTransactionDate = (dateStr: string | Date): Date => {
    if (dateStr instanceof Date) {
      return dateStr;
    }
    // Handle both "YYYY-MM-DD HH:MM:SS" and "YYYY-MM-DDTHH:MM:SS" formats
    const normalized = dateStr.replace(' ', 'T').split('.')[0]; // Remove milliseconds if present
    return new Date(normalized);
  };

  // Get today's date (without time) to filter out future transactions
  const today = useMemo(() => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    return date;
  }, []);

  // Filter transactions to only include those with date <= today
  // Exclude future transactions as they haven't happened yet
  const pastSelectedMonthTransactions = useMemo(() => {
    return selectedMonthTransactions.filter((t) => {
      if (!t.date) return false;
      try {
        const txDate = parseTransactionDate(t.date);
        txDate.setHours(0, 0, 0, 0);
        return txDate <= today;
      } catch (error) {
        return false; // Exclude if date parsing fails
      }
    });
  }, [selectedMonthTransactions, today]);

  const pastLastMonthTransactions = useMemo(() => {
    return lastMonthTransactions.filter((t) => {
      if (!t.date) return false;
      try {
        const txDate = parseTransactionDate(t.date);
        txDate.setHours(0, 0, 0, 0);
        return txDate <= today;
      } catch (error) {
        return false; // Exclude if date parsing fails
      }
    });
  }, [lastMonthTransactions, today]);

  // Generate all alerts and insights
  const alerts = useMemo(() => {
    const alertsList: Array<{
      type: "success" | "warning" | "danger";
      badge: string;
      text: string;
      action?: string;
      icon: React.ReactNode;
      category: "spending" | "debt" | "security";
    }> = [];

    // Savings rate alert
    const savingsRate = currentIncome > 0 ? ((currentIncome - currentExpenses) / currentIncome) * 100 : 0;
    if (savingsRate >= 15 && savingsRate < 22) {
      const additionalSavings = (currentIncome * 0.22) - (currentIncome - currentExpenses);
      alertsList.push({
        type: "success",
        badge: "Savings",
        text: `You're saving ${savingsRate.toFixed(0)}% of your income. Increasing this to 22% would help you reach your goals faster.`,
        action: `Save an additional $${additionalSavings.toFixed(0)} per month to reach the 22% savings target.`,
        icon: <CheckCircle2 className="h-5 w-5" />,
        category: "spending",
      });
    }

    // Emergency fund alert
    if (emergencyFundMonths < 6) {
      const monthsNeeded = 6 - emergencyFundMonths;
      const monthlySavings = currentIncome - currentExpenses;
      const recommendedTransfer = monthlySavings > 0 ? Math.max((monthlySavings * 0.1), 250) : 250;
      const monthsToReach = monthlySavings > 0 ? Math.ceil((monthsNeeded * currentExpenses) / monthlySavings) : 0;
      
      alertsList.push({
        type: "warning",
        badge: "Emergency fund",
        text: `Your emergency fund covers ${emergencyFundMonths.toFixed(1)} months. Aim for at least 6 months of expenses for better financial security.`,
        action: `Set up an automatic transfer of $${recommendedTransfer.toFixed(0)}/month to reach 6 months coverage in approximately ${monthsToReach} months.`,
        icon: <AlertCircle className="h-5 w-5" />,
        category: "security",
      });
    }

    // Overspending alert
    // Only include past transactions (exclude future ones)
    const currentMonthExpenses = calculateTotalExpenses(pastSelectedMonthTransactions);
    const lastMonthExpenses = calculateTotalExpenses(pastLastMonthTransactions);

    if (lastMonthExpenses > 0) {
      const expenseChange = ((currentMonthExpenses - lastMonthExpenses) / lastMonthExpenses) * 100;
      if (expenseChange > 20) {
        const excessAmount = currentMonthExpenses - lastMonthExpenses;
        alertsList.push({
          type: "danger",
          badge: "Overspending",
          text: `Your spending is ${expenseChange.toFixed(0)}% higher than last month, which is $${excessAmount.toFixed(0)} more than expected.`,
          action: `Review your budget categories and identify areas where you can reduce spending. Consider setting spending limits for discretionary categories.`,
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
          text: alert.description,
          action: alert.action || undefined,
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
    pastSelectedMonthTransactions,
    pastLastMonthTransactions,
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
        return <Wallet className="h-5 w-5" />;
      case "debt":
        return <CreditCard className="h-5 w-5" />;
      case "security":
        return <Shield className="h-5 w-5" />;
      default:
        return <Lightbulb className="h-5 w-5" />;
    }
  };

  const getIconColor = (type: "success" | "warning" | "danger") => {
    switch (type) {
      case "success":
        return "text-green-600 dark:text-green-400";
      case "warning":
        return "text-amber-600 dark:text-amber-400";
      case "danger":
        return "text-red-600 dark:text-red-400";
      default:
        return "text-muted-foreground";
    }
  };

  const getCategoryIconColor = (category: string) => {
    switch (category) {
      case "spending":
        return "text-blue-600 dark:text-blue-400";
      case "debt":
        return "text-purple-600 dark:text-purple-400";
      case "security":
        return "text-emerald-600 dark:text-emerald-400";
      default:
        return "text-muted-foreground";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl sm:max-h-[90vh] overflow-y-auto">
        <DialogHeader className="px-6 pt-6 pb-6 border-b">
          <DialogTitle className="text-2xl font-semibold">
            Spare Score Insights & Actions
          </DialogTitle>
          <DialogDescription className="text-sm mt-2 text-muted-foreground">
            Personalized insights and actionable steps to improve your financial health
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-8 px-6 py-6">
          {/* Score Summary */}
          {financialHealth && (
            <div className="rounded-lg p-6 border border-border bg-card">
              <div className="flex items-start justify-between gap-8 mb-6">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                    Current Spare Score
                  </p>
                  <div className="flex items-baseline gap-2 mb-1">
                    <p className="text-5xl font-bold text-foreground">{financialHealth.score}</p>
                    <span className="text-base font-medium text-muted-foreground">
                      / 100
                    </span>
                  </div>
                  <p className="text-base font-medium text-foreground">
                    {financialHealth.classification}
                  </p>
                </div>
                {financialHealth.message && (
                  <div className="flex-1 max-w-md">
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      {financialHealth.message}
                    </p>
                  </div>
                )}
              </div>
              
              {/* Metrics */}
              <div className="grid grid-cols-3 gap-8 pt-6 border-t border-border">
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">
                    Spending Discipline
                  </p>
                  <p className="text-base font-semibold text-foreground">
                    {financialHealth.spendingDiscipline}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">
                    Debt Exposure
                  </p>
                  <p className="text-base font-semibold text-foreground">
                    {financialHealth.debtExposure}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">
                    Emergency Fund
                  </p>
                  <p className="text-base font-semibold text-foreground">
                    {emergencyFundMonths.toFixed(1)} months
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Spending Actions */}
          {spendingAlerts.length > 0 && (
            <div className="space-y-5">
              <div className="flex items-center gap-3 pb-3 border-b border-border">
                <div className={cn("flex-shrink-0", getCategoryIconColor("spending"))}>
                  {getCategoryIcon("spending")}
                </div>
                <h3 className="font-semibold text-lg text-foreground">{getCategoryTitle("spending")}</h3>
                <span className="ml-auto text-xs text-muted-foreground">
                  {spendingAlerts.length} {spendingAlerts.length === 1 ? "item" : "items"}
                </span>
              </div>
              <div className="space-y-4">
                {spendingAlerts.map((alert, index) => (
                  <div
                    key={index}
                    className="p-5 rounded-lg border border-border bg-card hover:border-border/80 transition-colors"
                  >
                    <div className="flex items-start gap-4">
                      <div className={cn("flex-shrink-0 mt-0.5", getIconColor(alert.type))}>
                        {alert.icon}
                      </div>
                      <div className="flex-1 min-w-0 space-y-3">
                        <div>
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">
                            {alert.badge}
                          </p>
                          <p className="text-sm leading-relaxed text-foreground">
                            {alert.text}
                          </p>
                        </div>
                        {alert.action && (
                          <div className="pt-3 border-t border-border">
                            <div className="flex items-start gap-2.5">
                              <ArrowRight className={cn("h-4 w-4 mt-0.5 flex-shrink-0", getIconColor(alert.type))} />
                              <div className="flex-1">
                                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                                  Action
                                </p>
                                <p className="text-sm text-foreground leading-relaxed">
                                  {alert.action}
                                </p>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Debt Actions */}
          {debtAlerts.length > 0 && (
            <div className="space-y-5">
              <div className="flex items-center gap-3 pb-3 border-b border-border">
                <div className={cn("flex-shrink-0", getCategoryIconColor("debt"))}>
                  {getCategoryIcon("debt")}
                </div>
                <h3 className="font-semibold text-lg text-foreground">{getCategoryTitle("debt")}</h3>
                <span className="ml-auto text-xs text-muted-foreground">
                  {debtAlerts.length} {debtAlerts.length === 1 ? "item" : "items"}
                </span>
              </div>
              <div className="space-y-4">
                {debtAlerts.map((alert, index) => (
                  <div
                    key={index}
                    className="p-5 rounded-lg border border-border bg-card hover:border-border/80 transition-colors"
                  >
                    <div className="flex items-start gap-4">
                      <div className={cn("flex-shrink-0 mt-0.5", getIconColor(alert.type))}>
                        {alert.icon}
                      </div>
                      <div className="flex-1 min-w-0 space-y-3">
                        <div>
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">
                            {alert.badge}
                          </p>
                          <p className="text-sm leading-relaxed text-foreground">
                            {alert.text}
                          </p>
                        </div>
                        {alert.action && (
                          <div className="pt-3 border-t border-border">
                            <div className="flex items-start gap-2.5">
                              <ArrowRight className={cn("h-4 w-4 mt-0.5 flex-shrink-0", getIconColor(alert.type))} />
                              <div className="flex-1">
                                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                                  Action
                                </p>
                                <p className="text-sm text-foreground leading-relaxed">
                                  {alert.action}
                                </p>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Security Actions */}
          {securityAlerts.length > 0 && (
            <div className="space-y-5">
              <div className="flex items-center gap-3 pb-3 border-b border-border">
                <div className={cn("flex-shrink-0", getCategoryIconColor("security"))}>
                  {getCategoryIcon("security")}
                </div>
                <h3 className="font-semibold text-lg text-foreground">{getCategoryTitle("security")}</h3>
                <span className="ml-auto text-xs text-muted-foreground">
                  {securityAlerts.length} {securityAlerts.length === 1 ? "item" : "items"}
                </span>
              </div>
              <div className="space-y-4">
                {securityAlerts.map((alert, index) => (
                  <div
                    key={index}
                    className="p-5 rounded-lg border border-border bg-card hover:border-border/80 transition-colors"
                  >
                    <div className="flex items-start gap-4">
                      <div className={cn("flex-shrink-0 mt-0.5", getIconColor(alert.type))}>
                        {alert.icon}
                      </div>
                      <div className="flex-1 min-w-0 space-y-3">
                        <div>
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">
                            {alert.badge}
                          </p>
                          <p className="text-sm leading-relaxed text-foreground">
                            {alert.text}
                          </p>
                        </div>
                        {alert.action && (
                          <div className="pt-3 border-t border-border">
                            <div className="flex items-start gap-2.5">
                              <ArrowRight className={cn("h-4 w-4 mt-0.5 flex-shrink-0", getIconColor(alert.type))} />
                              <div className="flex-1">
                                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                                  Action
                                </p>
                                <p className="text-sm text-foreground leading-relaxed">
                                  {alert.action}
                                </p>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Suggestions */}
          {suggestions.length > 0 && (
            <div className="space-y-5">
              <div className="flex items-center gap-3 pb-3 border-b border-border">
                <div className="flex-shrink-0 text-blue-600 dark:text-blue-400">
                  <Lightbulb className="h-5 w-5" />
                </div>
                <h3 className="font-semibold text-lg text-foreground">Recommendations</h3>
                <span className="ml-auto text-xs text-muted-foreground">
                  {suggestions.length} {suggestions.length === 1 ? "item" : "items"}
                </span>
              </div>
              <div className="space-y-4">
                {suggestions.map((suggestion, index) => (
                  <div
                    key={suggestion.id || index}
                    className="p-5 rounded-lg border border-border bg-card hover:border-border/80 transition-colors"
                  >
                    <div className="flex items-start gap-4">
                      <div className="flex-shrink-0 mt-0.5 text-blue-600 dark:text-blue-400">
                        <Lightbulb className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0 space-y-2">
                        <div>
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">
                            {suggestion.impact === "high" ? "High Impact" : suggestion.impact === "medium" ? "Medium Impact" : "Low Impact"}
                          </p>
                          <h4 className="font-semibold text-sm mb-1.5 text-foreground">{suggestion.title}</h4>
                          <p className="text-sm leading-relaxed text-muted-foreground">{suggestion.description}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* No alerts or suggestions */}
          {alerts.length === 0 && suggestions.length === 0 && (
            <div className="text-center py-12 px-4">
              <div className="inline-flex items-center justify-center w-16 h-16 mb-4">
                <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">Great job!</h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
                Your Spare Score looks good. Keep up the excellent work!
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

