"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, CheckCircle2, Info, Lightbulb } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FinancialHealthData } from "@/src/application/shared/financial-health";

interface FinancialHealthInsightsProps {
  financialHealth: FinancialHealthData | null;
}

export function FinancialHealthInsights({ financialHealth }: FinancialHealthInsightsProps) {
  if (!financialHealth) {
    return null;
  }

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case "critical":
        return <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />;
      case "warning":
        return <AlertCircle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />;
      default:
        return <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical":
        return "border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950";
      case "warning":
        return "border-yellow-200 dark:border-yellow-900 bg-yellow-50 dark:bg-yellow-950";
      default:
        return "border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950";
    }
  };

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case "high":
        return "text-red-600 dark:text-red-400";
      case "medium":
        return "text-yellow-600 dark:text-yellow-400";
      default:
        return "text-green-600 dark:text-green-400";
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg md:text-xl flex items-center gap-2">
            <Lightbulb className="h-5 w-5" />
            Spare Score Insights
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Alerts */}
          {financialHealth.alerts.length > 0 && (
            <div className="space-y-3 mb-6">
              <h3 className="text-sm font-semibold">Alerts</h3>
              {financialHealth.alerts.map((alert) => (
                <Alert
                  key={alert.id}
                  className={cn(getSeverityColor(alert.severity))}
                >
                  <div className="flex items-start gap-3">
                    {getSeverityIcon(alert.severity)}
                    <div className="flex-1">
                      <AlertTitle className="text-sm font-semibold">
                        {alert.title}
                      </AlertTitle>
                      <AlertDescription className="text-sm mt-1">
                        {alert.description}
                      </AlertDescription>
                      {alert.action && (
                        <p className="text-xs mt-2 font-medium">{alert.action}</p>
                      )}
                    </div>
                  </div>
                </Alert>
              ))}
            </div>
          )}

          {/* Suggestions */}
          {financialHealth.suggestions.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" />
                Suggestions for Improvement
              </h3>
              <div className="space-y-2">
                {financialHealth.suggestions.map((suggestion) => (
                  <div
                    key={suggestion.id}
                    className="p-4 rounded-lg border bg-card"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-semibold text-sm">{suggestion.title}</p>
                          <span
                            className={cn(
                              "text-xs px-2 py-0.5 rounded-full",
                              suggestion.impact === "high"
                                ? "bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300"
                                : suggestion.impact === "medium"
                                ? "bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300"
                                : "bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300"
                            )}
                          >
                            {suggestion.impact} impact
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

          {/* No alerts or suggestions */}
          {financialHealth.alerts.length === 0 && financialHealth.suggestions.length === 0 && (
            <div className="text-center py-8">
              <CheckCircle2 className="h-12 w-12 text-green-600 dark:text-green-400 mx-auto mb-3" />
              <p className="text-sm font-medium">Great job!</p>
              <p className="text-sm text-muted-foreground mt-1">
                Your Spare Score looks good. Keep up the excellent work!
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

