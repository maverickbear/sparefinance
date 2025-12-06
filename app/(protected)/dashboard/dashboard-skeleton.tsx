import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CardSkeleton } from "@/components/ui/card-skeleton";
import { ChartSkeleton } from "@/components/ui/chart-skeleton";

/**
 * Dashboard skeleton that matches the actual dashboard layout
 * Shows widgets in their proper positions while data loads
 */
export function DashboardSkeleton() {
  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header with range selector and refresh button skeleton */}
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-7 w-48" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-8 rounded" />
          <Skeleton className="h-4 w-24" />
        </div>
      </div>

      {/* Summary Cards Grid */}
      <div className="grid gap-3 md:gap-4 grid-cols-2 lg:grid-cols-4">
        {/* Primary Balance Card */}
        <Card className="md:col-span-1 bg-primary border-primary">
          <CardContent className="p-4 md:p-5 flex flex-col h-full min-h-[160px]">
            <div className="flex items-start justify-between mb-4">
              <Skeleton className="h-6 w-24 rounded" />
            </div>
            <Skeleton className="h-5 w-32 mb-1" />
            <Skeleton className="h-8 w-40 mb-2" />
            <Skeleton className="h-4 w-28 mb-3" />
            <div className="mt-auto">
              <Skeleton className="h-3 w-32 mb-1" />
              <Skeleton className="h-6 w-36 mb-1" />
              <Skeleton className="h-3 w-48" />
            </div>
          </CardContent>
        </Card>

        {/* Income Card */}
        <Card>
          <CardContent className="p-4 md:p-5 flex flex-col h-full">
            <div className="flex flex-col items-start gap-2 mb-3">
              <Skeleton className="w-9 h-9 rounded-lg" />
              <Skeleton className="h-5 w-32" />
            </div>
            <Skeleton className="h-7 w-28 mb-2" />
            <Skeleton className="h-4 w-24" />
          </CardContent>
        </Card>

        {/* Expense Card */}
        <Card>
          <CardContent className="p-4 md:p-5 flex flex-col h-full">
            <div className="flex flex-col items-start gap-2 mb-3">
              <Skeleton className="w-9 h-9 rounded-lg" />
              <Skeleton className="h-5 w-32" />
            </div>
            <Skeleton className="h-7 w-28 mb-2" />
            <Skeleton className="h-4 w-24" />
          </CardContent>
        </Card>

        {/* Savings Card */}
        <Card>
          <CardContent className="p-4 md:p-5">
            <div className="flex flex-col items-start gap-2 mb-3">
              <Skeleton className="w-9 h-9 rounded-lg" />
              <Skeleton className="h-5 w-32" />
            </div>
            <Skeleton className="h-7 w-28 mb-2" />
            <Skeleton className="h-4 w-24" />
          </CardContent>
        </Card>
      </div>

      {/* Top Widgets - Spare Score and Expenses by Category */}
      <div className="grid gap-4 md:gap-6 grid-cols-1 lg:grid-cols-2">
        <CardSkeleton />
        <CardSkeleton />
      </div>

      {/* Cash Flow Timeline and Budget Status */}
      <div className="grid gap-4 md:gap-6 grid-cols-1 lg:grid-cols-2">
        <ChartSkeleton height={400} />
        <CardSkeleton />
      </div>

      {/* Recurring Payments and Savings Goals */}
      <div className="grid gap-4 md:gap-6 grid-cols-1 lg:grid-cols-2">
        <CardSkeleton />
        <CardSkeleton />
      </div>

      {/* Subscriptions Widget */}
      <CardSkeleton />

      {/* Net Worth and Investment Portfolio */}
      <div className="grid gap-4 md:gap-6 grid-cols-1 md:grid-cols-2">
        <ChartSkeleton height={300} />
        <CardSkeleton />
      </div>
    </div>
  );
}

