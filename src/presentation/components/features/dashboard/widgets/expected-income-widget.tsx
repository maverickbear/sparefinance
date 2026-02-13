"use client";

import { useState } from "react";
import type { ExpectedIncomeOverview } from "@/src/domain/dashboard/types";
import { WidgetCard } from "./widget-card";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/components/common/money";
import { Pencil } from "lucide-react";
import { ExpectedIncomeEditDialog } from "./expected-income-edit-dialog";
import { cn } from "@/lib/utils";

interface ExpectedIncomeWidgetProps {
  data: ExpectedIncomeOverview | null;
  onRefresh: () => void;
  className?: string;
}

export function ExpectedIncomeWidget({
  data,
  onRefresh,
  className,
}: ExpectedIncomeWidgetProps) {
  const [editOpen, setEditOpen] = useState(false);

  const handleEditSuccess = () => {
    onRefresh();
  };

  // When no overview data (e.g. old cache), show card with CTA to set expected income
  const hasExpectedIncome = data?.hasExpectedIncome ?? false;

  return (
    <>
      <WidgetCard
        title="Income"
        className={cn("min-h-0 h-auto", className)}
        headerAction={
          <Button
            variant="outline"
            size="icon"
            onClick={() => setEditOpen(true)}
            className="h-8 w-8 lg:h-10 lg:w-10"
            aria-label="Adjust income"
          >
            <Pencil className="h-3.5 w-3.5 lg:h-4 lg:w-4" />
          </Button>
        }
      >
        <div className="flex flex-col gap-2">
          {hasExpectedIncome && data ? (
            <>
              <div className="text-2xl font-bold">
                {formatMoney(data.actualIncomeThisMonth)}
              </div>
              {data.expectedMonthlyIncome > 0 && (
                <p className="text-sm text-muted-foreground">
                  {Math.round((data.actualIncomeThisMonth / data.expectedMonthlyIncome) * 100)}% of expected income
                </p>
              )}
              <p className="text-sm text-muted-foreground">
                Expected: {formatMoney(data.expectedMonthlyIncome)}
              </p>
              {data.nextPaycheckDays != null && data.nextPaycheckAmount != null ? (
                <p className="text-sm text-muted-foreground">
                  Next paycheck in {data.nextPaycheckDays} days ({formatMoney(data.nextPaycheckAmount)})
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Next paycheck: —
                </p>
              )}
              <p className="text-sm font-medium mt-0.5">
                {data.status === "below_target" ||
                (data.actualIncomeThisMonth <= 0 && data.expectedMonthlyIncome > 0)
                  ? "🔴 Below target"
                  : data.status === "slightly_below_target"
                    ? "🟡 Slightly below target"
                    : "🟢 On track"}
              </p>
            </>
          ) : (
            <div className="flex flex-col gap-3 py-1">
              <p className="text-sm text-muted-foreground">
                Set your expected monthly income to compare with spending.
              </p>
              <Button
                variant="default"
                size="small"
                onClick={() => setEditOpen(true)}
                className="w-fit"
              >
                Set income
              </Button>
            </div>
          )}
        </div>
      </WidgetCard>
      <ExpectedIncomeEditDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        onSuccess={handleEditSuccess}
      />
    </>
  );
}
