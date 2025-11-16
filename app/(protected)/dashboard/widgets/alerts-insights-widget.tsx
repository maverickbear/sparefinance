"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { CheckCircle2, AlertTriangle, AlertCircle } from "lucide-react";
import { calculateTotalExpenses } from "../utils/transaction-helpers";

interface AlertsInsightsWidgetProps {
  financialHealth: any;
  currentIncome: number;
  currentExpenses: number;
  emergencyFundMonths: number;
  selectedMonthTransactions: any[];
  lastMonthTransactions: any[];
  demoMode?: boolean; // Reserved for future use
}

export function AlertsInsightsWidget({
  financialHealth,
  currentIncome,
  currentExpenses,
  emergencyFundMonths,
  selectedMonthTransactions,
  lastMonthTransactions,
  demoMode = false,
}: AlertsInsightsWidgetProps) {
  // Generate alerts
  const alerts = useMemo(() => {
    const alertsList: Array<{
      type: "success" | "warning" | "danger";
      badge: string;
      text: string;
      icon: React.ReactNode;
    }> = [];

    // Savings rate alert
    const savingsRate = currentIncome > 0 ? ((currentIncome - currentExpenses) / currentIncome) * 100 : 0;
    if (savingsRate >= 15 && savingsRate < 22) {
      alertsList.push({
        type: "success",
        badge: "Savings",
        text: `You're saving ${savingsRate.toFixed(0)}% of your income. Increasing this to 22% would help you reach your goals faster.`,
        icon: <CheckCircle2 className="h-5 w-5" />,
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
      });
    }

    // Overspending alert - use helper function for consistency
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
        });
      }
    }

    return alertsList.map((alert) => {
      let icon: React.ReactNode;
      switch (alert.type) {
        case "success":
          icon = <CheckCircle2 className="h-5 w-5" />;
          break;
        case "warning":
          icon = <AlertCircle className="h-5 w-5" />;
          break;
        case "danger":
          icon = <AlertTriangle className="h-5 w-5" />;
          break;
        default:
          icon = <AlertCircle className="h-5 w-5" />;
      }

      return {
        ...alert,
        icon,
      };
    });
  }, [
    currentIncome,
    currentExpenses,
    emergencyFundMonths,
    selectedMonthTransactions,
    lastMonthTransactions,
  ]);

  return (
    <Card className="h-full">
      <CardHeader>
        <div>
          <CardTitle>Alerts & Insights</CardTitle>
          <CardDescription>What deserves your attention right now</CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        {alerts.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-muted-foreground">No alerts at this time</p>
          </div>
        ) : (
          <div className="space-y-3">
            {alerts.map((alert, index) => (
              <div
                key={index}
                className={cn(
                  "flex gap-3 p-4 rounded-lg border",
                  alert.type === "success" &&
                    "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800/50",
                  alert.type === "warning" &&
                    "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/50",
                  alert.type === "danger" &&
                    "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800/50"
                )}
              >
                <div className={cn(
                  "flex-shrink-0 mt-0.5",
                  alert.type === "success" && "text-green-600 dark:text-green-400",
                  alert.type === "warning" && "text-amber-600 dark:text-amber-400",
                  alert.type === "danger" && "text-red-600 dark:text-red-400"
                )}>
                  {alert.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <span
                    className={cn(
                      "inline-flex items-center px-2 py-1 rounded-md text-xs font-medium mb-2",
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
                  <p className="text-sm leading-relaxed text-foreground">
                    {alert.text}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

