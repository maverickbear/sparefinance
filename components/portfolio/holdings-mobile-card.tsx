"use client";

import { memo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { formatMoney } from "@/components/common/money";
import { cn } from "@/lib/utils";
import { Holding } from "@/lib/api/portfolio";

interface HoldingsMobileCardProps {
  holding: Holding;
}

export const HoldingsMobileCard = memo(function HoldingsMobileCard({ holding }: HoldingsMobileCardProps) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="space-y-4">
          {/* Header with Symbol and Market Value */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-lg font-semibold">{holding.symbol}</span>
                <span className={cn(
                  "rounded-[12px] px-2 py-1 text-xs",
                  holding.assetType === "Stock" 
                    ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" 
                    : holding.assetType === "ETF"
                    ? "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200"
                    : holding.assetType === "Crypto"
                    ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
                    : "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200"
                )}>
                  {holding.assetType}
                </span>
              </div>
              {holding.name && (
                <p className="text-sm text-muted-foreground mt-1 line-clamp-1">
                  {holding.name}
                </p>
              )}
            </div>
            <div className="text-right">
              <div className="text-lg font-semibold">{formatMoney(holding.marketValue)}</div>
            </div>
          </div>

          {/* Quantity and Prices */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Quantity</span>
              <span className="text-sm font-medium">{holding.quantity.toLocaleString()}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Current Price</span>
              <span className="text-sm font-medium">{formatMoney(holding.currentPrice)}</span>
            </div>
          </div>

          {/* P&L */}
          <div className="flex items-center justify-between pt-2 border-t">
            <div className="flex flex-col">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">P&L</span>
              <span className={cn(
                "text-sm font-semibold",
                holding.unrealizedPnL >= 0
                  ? "text-green-600 dark:text-green-400"
                  : "text-red-600 dark:text-red-400"
              )}>
                {holding.unrealizedPnL >= 0 ? "+" : ""}{formatMoney(holding.unrealizedPnL)}
              </span>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">P&L %</span>
              <span className={cn(
                "text-sm font-semibold",
                holding.unrealizedPnLPercent >= 0
                  ? "text-green-600 dark:text-green-400"
                  : "text-red-600 dark:text-red-400"
              )}>
                {holding.unrealizedPnLPercent >= 0 ? "+" : ""}{holding.unrealizedPnLPercent.toFixed(2)}%
              </span>
            </div>
          </div>

          {/* Sector (if available) */}
          {holding.sector && (
            <div className="flex flex-col pt-2 border-t">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Sector</span>
              <span className="text-sm font-medium">{holding.sector}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
});

