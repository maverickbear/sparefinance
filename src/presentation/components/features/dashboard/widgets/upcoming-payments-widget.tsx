"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, AlertTriangle, ArrowRight, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/components/common/money";
import { format } from "date-fns";
import type { UpcomingPaymentsWidgetData } from "@/src/domain/dashboard/types";
import { WidgetEmptyState } from "./widget-empty-state";
import { WidgetCard } from "./widget-card";

interface UpcomingPaymentsWidgetProps {
  data: UpcomingPaymentsWidgetData | null;
  loading?: boolean;
  error?: string | null;
}

export function UpcomingPaymentsWidget({ data, loading, error }: UpcomingPaymentsWidgetProps) {
  const router = useRouter();

  if (loading) {
    return (
      <WidgetCard title="Upcoming Payments">
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-muted rounded" />
          <div className="h-4 bg-muted rounded" />
        </div>
      </WidgetCard>
    );
  }

  if (error) {
    return (
      <WidgetCard title="Upcoming Payments">
        <div className="text-xs text-muted-foreground">
          <p>Error: {error}</p>
          <Button asChild variant="outline" size="small" className="mt-3">
            <a href="/planned-payments/new">Add Payment</a>
          </Button>
        </div>
      </WidgetCard>
    );
  }

  if (!data || data.payments.length === 0) {
    return (
      <WidgetCard title="Upcoming Payments">
        <WidgetEmptyState
          title="Add payments"
          description="Track upcoming bills"
          primaryAction={{
            label: "Add Payment",
            href: "/planned-payments/new",
          }}
          icon={Calendar}
        />
      </WidgetCard>
    );
  }

  return (
    <WidgetCard 
      title="Upcoming Payments"
      headerAction={
        <Link 
          href="/planning/planned-payments" 
          className="flex items-center text-sm font-medium hover:underline"
        >
          See all <ArrowRight className="ml-1 h-4 w-4" />
        </Link>
      }
    >
      <div className="flex-1 flex flex-col justify-between">
        <div className="space-y-1.5">
          {/* Summary - Compact */}
          {data.totalDueNext7Days > 0 && (
            <div className="p-2 rounded border bg-sentiment-warning/5 border-sentiment-warning/20">
              <p className="text-xs font-medium text-sentiment-warning">
                ${data.totalDueNext7Days.toFixed(2)} due in 7 days
              </p>
            </div>
          )}

          {/* Payments List - Compact */}
          {data.payments.slice(0, 4).map((payment) => (
            <div
              key={payment.id}
              onClick={() => router.push(`/planned-payments/${payment.id}`)}
              className={cn(
                "p-2 rounded border hover:bg-muted/30 transition-colors cursor-pointer",
                payment.isOverBudget && "border-sentiment-negative/30 bg-sentiment-negative/5"
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="text-xs font-medium truncate">{payment.description}</span>
                    {payment.isOverBudget && (
                      <AlertTriangle className="h-3 w-3 text-sentiment-negative flex-shrink-0" />
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    <span>{format(new Date(payment.date), "MMM dd")}</span>
                    {payment.daysUntil <= 7 && (
                      <span className="text-sentiment-warning">
                        ({payment.daysUntil}d)
                      </span>
                    )}
                  </div>
                </div>
                <span className="text-xs font-semibold">{formatMoney(payment.amount)}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Primary Action */}
        <Button
          variant="ghost"
          size="small"
          className="w-full mt-auto text-xs"
          onClick={() => router.push("/planned-payments/new")}
        >
          <Plus className="h-3 w-3 mr-1.5" />
          Add Payment
        </Button>
      </div>
    </WidgetCard>
  );
}
