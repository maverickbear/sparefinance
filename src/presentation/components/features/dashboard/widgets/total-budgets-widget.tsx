"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { TotalBudgetsWidgetData } from "@/src/domain/dashboard/types";
import { WidgetCard } from "./widget-card";

interface TotalBudgetsWidgetProps {
  data: TotalBudgetsWidgetData | null;
  className?: string;
}

export function TotalBudgetsWidget({ data, className }: TotalBudgetsWidgetProps) {
  if (!data) return null;

  return (
    <WidgetCard
      title="Total budgets"
      className={className}
      headerAction={
        <Button variant="ghost" size="small" asChild className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground">
          <Link href="/planning/budgets">See All</Link>
        </Button>
      }
    >
      <div className="flex flex-col h-full space-y-6">
        <div>
          <span className="text-3xl font-bold tracking-tight">
            ${data.totalAmount.toLocaleString()}
          </span>
        </div>

        {/* Allocation Bar */}
        <div className="h-4 w-full flex rounded-full overflow-hidden bg-muted">
          {data.categories.map((cat, i) => (
            <div
              key={cat.id}
              style={{ 
                width: `${cat.allocationPercentage}%`,
                backgroundColor: cat.color 
              }}
              className="h-full border-r border-background last:border-0"
            />
          ))}
        </div>

        {/* Categories List */}
        <div className="space-y-4">
          {data.categories.map((cat) => {
            const remaining = cat.budget - cat.spent;
            const remainingPercent = cat.budget > 0 ? (remaining / cat.budget) * 100 : 0;
            
            return (
              <div key={cat.id} className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center p-2 rounded-full bg-accent/30">
                     <span 
                       className="w-1 h-4 rounded-full" 
                       style={{ backgroundColor: cat.color }}
                     />
                  </div>
                  <div className="flex flex-col">
                    <span className="font-medium text-sm">{cat.name}</span>
                    <span className="text-xs text-pink-500">
                      -${cat.spent.toLocaleString()} spent
                    </span>
                  </div>
                </div>
                
                <div className="flex flex-col items-end">
                   <div className="flex items-center gap-1">
                      <span className="font-medium text-sm text-emerald-500">
                        ${remaining.toLocaleString()}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        ({remainingPercent.toFixed(1)}%)
                      </span>
                   </div>
                   <span className="text-xs text-muted-foreground">
                     Budget ${cat.budget.toLocaleString()}
                   </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </WidgetCard>
  );
}
