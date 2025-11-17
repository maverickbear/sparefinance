"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FinancialHealthData } from "@/lib/api/financial-health";
import { formatMoney } from "@/components/common/money";
import { cn } from "@/lib/utils";
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  Info,
  Target,
  Lightbulb,
  LineChart,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";

interface FinancialHealthModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: FinancialHealthData;
  lastMonthIncome?: number;
  lastMonthExpenses?: number;
}

export function FinancialHealthModal({
  isOpen,
  onClose,
  data,
  lastMonthIncome,
  lastMonthExpenses,
}: FinancialHealthModalProps) {
  // Calculate month-over-month changes
  const incomeMomChange = lastMonthIncome !== undefined && lastMonthIncome > 0
    ? ((data.monthlyIncome - lastMonthIncome) / lastMonthIncome) * 100
    : null;

  const expensesMomChange = lastMonthExpenses !== undefined && lastMonthExpenses > 0
    ? ((data.monthlyExpenses - lastMonthExpenses) / lastMonthExpenses) * 100
    : null;

  const hasLastMonthIncome = lastMonthIncome !== undefined;
  const hasLastMonthExpenses = lastMonthExpenses !== undefined;
  const getClassificationColor = (classification: string) => {
    switch (classification) {
      case "Excellent":
        return "text-green-600 dark:text-green-400";
      case "Good":
        return "text-green-600 dark:text-green-400";
      case "Fair":
        return "text-yellow-600 dark:text-yellow-400";
      case "Poor":
        return "text-orange-600 dark:text-orange-400";
      case "Critical":
        return "text-red-600 dark:text-red-400";
      default:
        return "text-muted-foreground";
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 91) return "text-green-600 dark:text-green-400"; // Excellent
    if (score >= 81) return "text-green-600 dark:text-green-400"; // Good
    if (score >= 71) return "text-yellow-600 dark:text-yellow-400"; // Fair
    if (score >= 61) return "text-orange-600 dark:text-orange-400"; // Poor
    return "text-red-600 dark:text-red-400"; // Critical
  };


  const getAlertIcon = (severity: string) => {
    switch (severity) {
      case "critical":
        return <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />;
      case "warning":
        return <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />;
      default:
        return <Info className="h-5 w-5 text-blue-600 dark:text-blue-400" />;
    }
  };

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case "high":
        return "border-red-500 bg-red-50 dark:bg-red-900/10";
      case "medium":
        return "border-yellow-500 bg-yellow-50 dark:bg-yellow-900/10";
      default:
        return "border-blue-500 bg-blue-50 dark:bg-blue-900/10";
    }
  };


  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-4xl sm:max-h-[90vh] flex flex-col !p-0 !gap-0">
        <DialogHeader>
          <DialogTitle className="text-2xl">Spare Score Analysis</DialogTitle>
          <DialogDescription>
            Monthly Income vs Monthly Expenses comparison and recommendations
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-6">
          <div className="space-y-6">
          {/* Score Overview */}
          <div className="flex items-center justify-between p-6 rounded-[12px] bg-card">
            <div className="flex flex-col gap-2">
              <div className="flex items-baseline gap-2">
                <span className={cn("text-2xl font-semibold", getScoreColor(data.score))}>
                  {data.score}
                </span>
                <span className="text-sm text-muted-foreground">/100</span>
              </div>
              <div className={cn(
                "inline-flex items-center gap-2 px-4 py-2 rounded-full text-base font-semibold w-fit",
                getClassificationColor(data.classification)
              )}>
                {data.classification === "Excellent" && <CheckCircle2 className="h-5 w-5" />}
                {data.classification === "Critical" && <AlertTriangle className="h-5 w-5" />}
                {data.classification}
              </div>
              {data.message && (
                <p className="text-base text-muted-foreground mt-2">
                  {data.message}
                </p>
              )}
            </div>
            <div className="text-right space-y-1">
              <p className="text-sm text-muted-foreground">Net Amount</p>
              <p className={cn(
                "text-2xl font-semibold",
                data.netAmount >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
              )}>
                {formatMoney(data.netAmount)}
              </p>
            </div>
          </div>

          {/* Income vs Expenses Breakdown */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <LineChart className="h-5 w-5" />
              Monthly Income vs Expenses
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-[12px] bg-card">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-green-600 dark:text-green-400" />
                    <span className="text-sm font-medium">Monthly Income</span>
                  </div>
                </div>
                <p className="text-2xl font-semibold text-green-600 dark:text-green-400">
                  {formatMoney(data.monthlyIncome)}
                </p>
                <p className={`text-xs mt-1 ${
                  hasLastMonthIncome && incomeMomChange !== null
                    ? incomeMomChange >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                    : "text-muted-foreground"
                }`}>
                  {hasLastMonthIncome && incomeMomChange !== null
                    ? `${incomeMomChange >= 0 ? "+" : ""}${incomeMomChange.toFixed(1)}% vs last month`
                    : "No data last month"
                  }
                </p>
              </div>

              <div className="p-4 rounded-[12px] bg-card">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <TrendingDown className="h-4 w-4 text-red-600 dark:text-red-400" />
                    <span className="text-sm font-medium">Monthly Expenses</span>
                  </div>
                </div>
                <p className="text-2xl font-semibold text-red-600 dark:text-red-400">
                  {formatMoney(data.monthlyExpenses)}
                </p>
                <p className={`text-xs mt-1 ${
                  hasLastMonthExpenses && expensesMomChange !== null
                    ? expensesMomChange >= 0 ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"
                    : "text-muted-foreground"
                }`}>
                  {hasLastMonthExpenses && expensesMomChange !== null
                    ? `${expensesMomChange >= 0 ? "+" : ""}${expensesMomChange.toFixed(1)}% vs last month`
                    : "No data last month"
                  }
                </p>
              </div>
            </div>

            {/* Net Amount and Savings Rate */}
            <div className="p-4 rounded-[12px] bg-card">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  {data.netAmount >= 0 ? (
                    <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-400" />
                  ) : (
                    <TrendingDown className="h-5 w-5 text-red-600 dark:text-red-400" />
                  )}
                  <span className="text-sm font-medium">Net Amount</span>
                </div>
                <span className={cn(
                  "text-lg font-semibold",
                  data.netAmount >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                )}>
                  {formatMoney(data.netAmount)}
                </span>
              </div>
              <div className="mt-2">
                <p className="text-xs text-muted-foreground mb-1">Savings Rate</p>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={cn(
                        "h-full transition-all",
                        data.savingsRate >= 50 ? "bg-green-500 dark:bg-green-600" :
                        data.savingsRate >= 30 ? "bg-blue-500 dark:bg-blue-600" :
                        data.savingsRate >= 20 ? "bg-yellow-500 dark:bg-yellow-600" :
                        data.savingsRate >= 10 ? "bg-orange-500 dark:bg-orange-600" :
                        data.savingsRate >= 0 ? "bg-orange-300 dark:bg-orange-500" : "bg-red-500 dark:bg-red-600"
                      )}
                      style={{ width: `${Math.min(Math.max(data.savingsRate, -100), 100) + 100}%` }}
                    />
                  </div>
                  <span className={cn(
                    "text-sm font-semibold",
                    data.savingsRate >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                  )}>
                    {data.savingsRate >= 0 ? "+" : ""}{data.savingsRate.toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
          </div>


          {/* Alerts */}
          {data.alerts.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                Critical Points
              </h3>
              <div className="space-y-3">
                {data.alerts.map((alert) => (
                  <div
                    key={alert.id}
                    className={cn(
                      "p-4 rounded-[12px] border",
                      alert.severity === "critical"
                        ? "bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800"
                        : alert.severity === "warning"
                        ? "bg-yellow-50 dark:bg-yellow-900/10 border-yellow-200 dark:border-yellow-800"
                        : "bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      {getAlertIcon(alert.severity)}
                      <div className="flex-1">
                        <h4 className="font-semibold mb-1">{alert.title}</h4>
                        <p className="text-sm text-muted-foreground mb-2">
                          {alert.description}
                        </p>
                        <div className="flex items-center gap-2 text-sm">
                          <Target className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">Suggested action:</span>
                          <span className="text-muted-foreground">{alert.action}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Suggestions */}
          {data.suggestions.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Lightbulb className="h-5 w-5" />
                How to Improve
              </h3>
              <div className="space-y-3">
                {data.suggestions.map((suggestion) => (
                  <div
                    key={suggestion.id}
                    className={cn(
                      "p-4 rounded-[12px] border",
                      getImpactColor(suggestion.impact)
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div className={cn(
                        "p-2 rounded-full",
                        suggestion.impact === "high" ? "bg-red-100 dark:bg-red-900/20" :
                        suggestion.impact === "medium" ? "bg-yellow-100 dark:bg-yellow-900/20" :
                        "bg-blue-100 dark:bg-blue-900/20"
                      )}>
                        {suggestion.impact === "high" ? (
                          <ArrowDownRight className="h-4 w-4 text-red-600 dark:text-red-400" />
                        ) : suggestion.impact === "medium" ? (
                          <ArrowUpRight className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                        ) : (
                          <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-semibold">{suggestion.title}</h4>
                          <span className={cn(
                            "text-xs px-2 py-0.5 rounded-full font-medium",
                            suggestion.impact === "high" ? "bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400" :
                            suggestion.impact === "medium" ? "bg-yellow-100 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400" :
                            "bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400"
                          )}>
                            {suggestion.impact === "high" ? "High Impact" :
                             suggestion.impact === "medium" ? "Medium Impact" : "Low Impact"}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {suggestion.description}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

