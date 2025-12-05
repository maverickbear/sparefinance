import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface ListSkeletonProps {
  className?: string;
  itemCount?: number;
  rowCount?: number;
}

export function ListSkeleton({ className, itemCount = 3 }: ListSkeletonProps) {
  return (
    <Card className={className}>
      <CardHeader>
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-3 w-48 mt-2" />
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {Array.from({ length: itemCount }).map((_, i) => (
            <div key={i} className="flex items-center justify-between p-3 rounded-lg border border-border">
              <div className="flex items-center gap-3 flex-1">
                <Skeleton className="h-4 w-4 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function TableSkeleton({ className, rowCount = 5 }: ListSkeletonProps) {
  return (
    <div className={`rounded-lg border border-border overflow-x-auto ${className}`}>
      <div className="p-4 space-y-3">
        {/* Header */}
        <div className="flex gap-4">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-20" />
        </div>
        {/* Rows */}
        {Array.from({ length: rowCount }).map((_, i) => (
          <div key={i} className="flex gap-4 py-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function GoalsOverviewSkeleton({ className }: ListSkeletonProps) {
  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-3 w-48 mt-2" />
          </div>
          <Skeleton className="h-8 w-16" />
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Overall Progress */}
        <div className="flex items-center gap-6">
          <Skeleton className="h-20 w-20 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-28" />
          </div>
        </div>
        {/* Statistics Grid */}
        <div className="grid grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="space-y-1">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-6 w-12" />
            </div>
          ))}
        </div>
        {/* Top Goals */}
        <div className="space-y-3 pt-2 border-t border-border">
          <Skeleton className="h-4 w-20" />
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3 p-2 rounded-lg">
                <Skeleton className="h-12 w-12 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function FinancialHealthSkeleton({ className }: ListSkeletonProps) {
  return (
    <Card className={className}>
      <CardHeader>
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-3 w-48 mt-2" />
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Score Display */}
        <div className="space-y-2">
          <Skeleton className="h-10 w-16" />
          <Skeleton className="h-6 w-24 rounded-full" />
          <Skeleton className="h-4 w-48" />
        </div>
        {/* Cost of Living */}
        <div className="p-3 rounded-lg border border-border">
          <Skeleton className="h-3 w-24 mb-2" />
          <Skeleton className="h-6 w-32" />
        </div>
        {/* Alerts */}
        <div className="space-y-2">
          <Skeleton className="h-4 w-24" />
          {[1, 2].map((i) => (
            <div key={i} className="p-3 rounded-lg border border-border">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-3 w-3/4 mt-2" />
            </div>
          ))}
        </div>
        <Skeleton className="h-10 w-full rounded-lg" />
      </CardContent>
    </Card>
  );
}

