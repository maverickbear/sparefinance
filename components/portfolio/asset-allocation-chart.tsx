"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { formatMoney, formatMoneyCompact } from "@/components/common/money";
import { getAssetTypeColor } from "@/lib/utils/portfolio-utils";

interface AssetAllocationData {
  type: string;
  value: number;
  percent: number;
  count: number;
}

interface AssetAllocationChartProps {
  data: AssetAllocationData[];
}

export function AssetAllocationChart({ data }: AssetAllocationChartProps) {
  // Sort data by value descending
  const sortedData = [...data].sort((a, b) => b.value - a.value);

  // Calculate total value
  const totalValue = sortedData.reduce((sum, item) => sum + item.value, 0);

  // Calculate donut chart segments
  const radius = 75;
  const circumference = 2 * Math.PI * radius;
  const strokeWidth = 12;
  const svgSize = 180;
  const center = svgSize / 2;
  let accumulatedLength = 0;

  const segments = sortedData.map((item) => {
    const segmentLength = (item.percent / 100) * circumference;
    // Each segment starts where the previous one ended
    // strokeDashoffset moves the dash pattern start position
    const offset = -accumulatedLength;
    accumulatedLength += segmentLength;
    return {
      ...item,
      offset,
      segmentLength,
      color: getAssetTypeColor(item.type),
    };
  });

  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex-1">
          <CardTitle>Asset Allocation</CardTitle>
          <CardDescription>Portfolio distribution by asset type</CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
          {/* Donut Chart */}
          <div className="relative flex-shrink-0">
            <svg
              className="transform -rotate-90"
              width={svgSize}
              height={svgSize}
              viewBox={`0 0 ${svgSize} ${svgSize}`}
            >
              {/* Background circle */}
              <circle
                cx={center}
                cy={center}
                r={radius}
                fill="none"
                stroke="hsl(var(--muted))"
                strokeWidth={strokeWidth}
              />
              {/* Segments */}
              {segments.map((segment, index) => (
                <circle
                  key={index}
                  cx={center}
                  cy={center}
                  r={radius}
                  fill="none"
                  stroke={segment.color}
                  strokeWidth={strokeWidth}
                  strokeDasharray={`${segment.segmentLength} ${circumference - segment.segmentLength}`}
                  strokeDashoffset={segment.offset}
                  strokeLinecap="round"
                  className="transition-all duration-300 hover:opacity-80"
                />
              ))}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="text-2xl font-bold text-foreground tabular-nums">
                {formatMoneyCompact(totalValue)}
              </div>
              <div className="text-xs text-muted-foreground">Total</div>
            </div>
          </div>

          {/* Legend */}
          <div className="flex-1 space-y-1 min-w-0">
            {sortedData.slice(0, 7).map((item, index) => {
              const color = getAssetTypeColor(item.type);
              return (
                <div
                  key={index}
                  className="flex items-center justify-between gap-2 py-1 px-1.5 rounded-md hover:bg-muted transition-colors"
                >
                  <div className="flex items-center gap-1.5 flex-1 min-w-0">
                    <div
                      className="h-2.5 w-2.5 rounded-sm flex-shrink-0"
                      style={{ backgroundColor: color }}
                    />
                    <span className="text-sm font-medium text-foreground truncate">
                      {item.type}
                    </span>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <span className="text-sm font-semibold text-foreground tabular-nums">
                      {formatMoneyCompact(item.value)}
                    </span>
                    <span className="text-xs text-muted-foreground ml-1">
                      {item.percent.toFixed(1)}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

