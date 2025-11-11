"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FinancialHealthData } from "@/lib/api/financial-health";
import { FinancialHealthModal } from "./financial-health-modal";
import { 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  CheckCircle2, 
  Info,
  Heart,
  ArrowRight,
  ArrowUpRight,
  ArrowDownRight
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/components/common/money";

interface FinancialHealthWidgetProps {
  data: FinancialHealthData;
  lastMonthIncome?: number;
  lastMonthExpenses?: number;
}

export function FinancialHealthWidget({ data, lastMonthIncome, lastMonthExpenses }: FinancialHealthWidgetProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

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

  const getClassificationBgColor = (classification: string) => {
    switch (classification) {
      case "Excellent":
        return "bg-green-100 dark:bg-green-900/20";
      case "Good":
        return "bg-green-100 dark:bg-green-900/20";
      case "Fair":
        return "bg-yellow-100 dark:bg-yellow-900/20";
      case "Poor":
        return "bg-orange-100 dark:bg-orange-900/20";
      case "Critical":
        return "bg-red-100 dark:bg-red-900/20";
      default:
        return "bg-muted";
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
        return <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />;
      case "warning":
        return <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />;
      default:
        return <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />;
    }
  };

  const mainAlerts = data.alerts.slice(0, 3);
  const hasAlerts = data.alerts.length > 0;

  return (
    <>
      <Card className="w-full group">
        <CardHeader>
          <CardTitle>
            Financial Health
          </CardTitle>
          <CardDescription>
            Monthly Income vs Monthly Expenses comparison
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Score Display */}
          <div className="flex flex-col gap-1">
            <div className="flex items-baseline gap-2">
              <span className={cn("text-4xl font-semibold", getScoreColor(data.score))}>
                {data.score}
              </span>
              <span className="text-sm text-muted-foreground">/100</span>
            </div>
            <div className={cn(
              "inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-semibold w-fit",
              getClassificationBgColor(data.classification),
              getClassificationColor(data.classification)
            )}>
              {data.classification === "Excellent" && <CheckCircle2 className="h-4 w-4" />}
              {data.classification === "Critical" && <AlertTriangle className="h-4 w-4" />}
              {data.classification}
            </div>
            {data.message && (
              <p className="text-sm text-muted-foreground mt-1">
                {data.message}
              </p>
            )}
          </div>


          {/* Cost of Living */}
          <div className="space-y-1 p-3 rounded-[12px] bg-card">
            <p className="text-xs text-muted-foreground">Cost of Living</p>
            <p className="text-lg font-semibold flex items-center gap-2 text-foreground">
              {formatMoney(data.monthlyExpenses)}
              <span className="text-sm text-muted-foreground">
                ({data.monthlyIncome > 0 ? ((data.monthlyExpenses / data.monthlyIncome) * 100).toFixed(1) : "0.0"}%)
              </span>
            </p>
          </div>

          {/* Alerts */}
          {hasAlerts && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Main Alerts</p>
              <div className="space-y-2">
                {mainAlerts.map((alert) => (
                  <div
                    key={alert.id}
                    className={cn(
                      "flex items-start gap-2 p-3 rounded-[12px] border",
                      alert.severity === "critical" 
                        ? "bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800"
                        : alert.severity === "warning"
                        ? "bg-yellow-50 dark:bg-yellow-900/10 border-yellow-200 dark:border-yellow-800"
                        : "bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800"
                    )}
                  >
                    {getAlertIcon(alert.severity)}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{alert.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                        {alert.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* View Details Button */}
          <Button
            className="w-full"
            onClick={() => setIsModalOpen(true)}
          >
            View Full Details
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </CardContent>
      </Card>

      <FinancialHealthModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        data={data}
        lastMonthIncome={lastMonthIncome}
        lastMonthExpenses={lastMonthExpenses}
      />
    </>
  );
}

