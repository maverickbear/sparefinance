"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FinancialAlertsWidgetData } from "@/src/domain/dashboard/types";
import { WidgetEmptyState } from "./widget-empty-state";
import { WidgetCard } from "./widget-card";

interface FinancialAlertsWidgetProps {
  data: FinancialAlertsWidgetData;
  loading?: boolean;
  error?: string | null;
}

export function FinancialAlertsWidget({ data, loading, error }: FinancialAlertsWidgetProps) {
  const router = useRouter();

  if (loading) {
    return (
      <WidgetCard title="Alerts" compact>
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-muted rounded" />
          <div className="h-4 bg-muted rounded" />
        </div>
      </WidgetCard>
    );
  }

  if (error) {
    return (
      <WidgetCard title="Alerts" compact>
        <div className="text-xs text-muted-foreground">
          <p>Error: {error}</p>
        </div>
      </WidgetCard>
    );
  }

  if (!data.hasAlerts || data.alerts.length === 0) {
    return (
      <WidgetCard title="Alerts" compact>
        <div className="flex flex-col items-center justify-center py-6 text-center">
          <CheckCircle2 className="h-8 w-8 text-sentiment-positive mb-2" />
          <p className="text-xs text-muted-foreground">All good!</p>
        </div>
      </WidgetCard>
    );
  }

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <AlertTriangle className="h-5 w-5 text-sentiment-negative" />;
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-sentiment-warning" />;
      default:
        return <Info className="h-5 w-5 text-primary" />;
    }
  };

  const getSeverityStyles = (severity: string) => {
    switch (severity) {
      case 'critical':
        return "bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800";
      case 'warning':
        return "bg-yellow-50 dark:bg-yellow-900/10 border-yellow-200 dark:border-yellow-800";
      default:
        return "bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800";
    }
  };

  return (
    <WidgetCard title="Alerts" compact>
      <div className="space-y-1.5">
        {data.alerts.slice(0, 3).map((alert) => (
          <div
            key={alert.id}
            onClick={() => alert.actionHref && router.push(alert.actionHref)}
            className={cn(
              "p-2 rounded border cursor-pointer hover:bg-muted/30 transition-colors",
              getSeverityStyles(alert.severity)
            )}
          >
            <div className="flex items-start gap-2">
              {getSeverityIcon(alert.severity)}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold mb-0.5">{alert.title}</p>
                <p className="text-xs text-muted-foreground line-clamp-1">{alert.description}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </WidgetCard>
  );
}
