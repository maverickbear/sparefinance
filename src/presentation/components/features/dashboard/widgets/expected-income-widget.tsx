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
            size="small"
            onClick={() => setEditOpen(true)}
            className="h-8 px-2 text-xs gap-1"
          >
            <Pencil className="h-3.5 w-3.5" />
            Adjust
          </Button>
        }
      >
        <div className="flex flex-col gap-2">
          {hasExpectedIncome && data ? (
            <>
              <span className="text-xs text-muted-foreground">Actual income this month</span>
              <div className="text-2xl font-bold">
                {formatMoney(data.actualIncomeThisMonth)}
              </div>
              <p className="text-xs text-muted-foreground pt-0.5">
                Expected: {formatMoney(data.expectedMonthlyIncome)}/month
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
