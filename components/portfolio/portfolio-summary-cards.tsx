"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { formatMoney } from "@/components/common/money";
import { TrendingUp, TrendingDown, Wallet, BarChart3, Plus, Upload, RefreshCw } from "lucide-react";
import { PortfolioSummary } from "@/lib/api/portfolio";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface PortfolioSummaryCardsProps {
  summary: PortfolioSummary;
  onAddClick?: () => void;
  onImportClick?: () => void;
  onUpdatePrices?: () => void;
  isUpdatingPrices?: boolean;
}

export function PortfolioSummaryCards({ 
  summary,
  onAddClick,
  onImportClick,
  onUpdatePrices,
  isUpdatingPrices = false,
}: PortfolioSummaryCardsProps) {
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  const prevIsUpdatingRef = useRef(isUpdatingPrices);

  // Update current time every minute to refresh relative time display
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000); // Update every minute

    return () => clearInterval(interval);
  }, []);

  // Update timestamp when prices finish updating
  useEffect(() => {
    // Set initial timestamp on mount if not set
    if (lastUpdated === null && !isUpdatingPrices) {
      setLastUpdated(new Date());
    }
    
    // Update timestamp when refresh completes (isUpdatingPrices changes from true to false)
    if (prevIsUpdatingRef.current === true && isUpdatingPrices === false) {
      setLastUpdated(new Date());
    }
    
    prevIsUpdatingRef.current = isUpdatingPrices;
  }, [isUpdatingPrices, lastUpdated]);

  // Function to format relative time
  const relativeTimeText = useMemo(() => {
    if (!lastUpdated) return null;
    const now = currentTime;
    const diffInSeconds = Math.floor((now.getTime() - lastUpdated.getTime()) / 1000);
    
    // Less than 1 minute
    if (diffInSeconds < 60) {
      return "Just Now";
    }
    
    // Less than 1 hour
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) {
      return `${diffInMinutes}m ago`;
    }
    
    // Less than 1 day
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) {
      return `${diffInHours}h ago`;
    }
    
    // Less than 1 week
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) {
      return `${diffInDays}d ago`;
    }
    
    // Less than 1 month (approximately 4 weeks)
    const diffInWeeks = Math.floor(diffInDays / 7);
    if (diffInWeeks < 4) {
      return `${diffInWeeks}w ago`;
    }
    
    // Less than 1 year
    const diffInMonths = Math.floor(diffInDays / 30);
    if (diffInMonths < 12) {
      return `${diffInMonths}m ago`;
    }
    
    // More than 1 year
    const diffInYears = Math.floor(diffInDays / 365);
    return `${diffInYears}y ago`;
  }, [lastUpdated, currentTime]);

  const cards = [
    {
      id: 'totalValue',
      title: 'Total Portfolio Value',
      icon: Wallet,
      iconColor: 'text-blue-600 dark:text-blue-500',
      value: summary.totalValue,
      valueColor: summary.totalValue >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400',
      change: null,
    },
    {
      id: 'dayChange',
      title: 'Day Change',
      icon: summary.dayChange >= 0 ? TrendingUp : TrendingDown,
      iconColor: summary.dayChange >= 0 ? 'text-green-600 dark:text-green-500' : 'text-red-600 dark:text-red-500',
      value: summary.dayChange,
      valueColor: summary.dayChange >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400',
      change: (
        <div
          className={cn(
            "text-xs mt-1",
            summary.dayChangePercent >= 0
              ? "text-green-600 dark:text-green-400"
              : "text-red-600 dark:text-red-400"
          )}
        >
          {summary.dayChangePercent >= 0 ? "+" : ""}{summary.dayChangePercent.toFixed(2)}%
        </div>
      ),
    },
    {
      id: 'totalReturn',
      title: 'Total Return',
      icon: summary.totalReturn >= 0 ? TrendingUp : TrendingDown,
      iconColor: summary.totalReturn >= 0 ? 'text-green-600 dark:text-green-500' : 'text-red-600 dark:text-red-500',
      value: summary.totalReturn,
      valueColor: summary.totalReturn >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400',
      change: (
        <div
          className={cn(
            "text-xs mt-1",
            summary.totalReturnPercent >= 0
              ? "text-green-600 dark:text-green-400"
              : "text-red-600 dark:text-red-400"
          )}
        >
          {summary.totalReturnPercent >= 0 ? "+" : ""}{summary.totalReturnPercent.toFixed(2)}%
        </div>
      ),
    },
    {
      id: 'holdings',
      title: 'Holdings',
      icon: BarChart3,
      iconColor: 'text-blue-600 dark:text-blue-500',
      value: summary.holdingsCount,
      valueColor: 'text-foreground',
      change: (
        <div className="text-xs mt-1 text-muted-foreground">
          Total positions
        </div>
      ),
    },
  ];

  const totalValueCard = cards.find(card => card.id === 'totalValue');
  const holdingsCard = cards.find(card => card.id === 'holdings');
  const dayChangeCard = cards.find(card => card.id === 'dayChange');
  const totalReturnCard = cards.find(card => card.id === 'totalReturn');

  const renderCard = (card: typeof cards[0]) => {
    const Icon = card.icon;
    return (
      <div key={card.id} className="flex flex-col p-4 border rounded-lg">
        <div className="flex flex-col items-start mb-3">
          <Icon className={cn("h-5 w-5 mb-2", card.iconColor)} />
          <div className="font-semibold text-xs md:text-sm">{card.title}</div>
        </div>
        <div className="flex items-baseline gap-2">
          <div className={cn("font-semibold", card.valueColor)}>
            {card.id === 'holdings' ? card.value : formatMoney(card.value)}
          </div>
          {card.change}
        </div>
      </div>
    );
  };

  return (
    <div>
      {/* Mobile and Tablet: Action buttons before Portfolio Summary */}
      <div className="lg:hidden mb-4">
        <div className="grid grid-cols-3 gap-3">
          <Button
            variant="outline"
            className="flex flex-col items-center justify-center gap-2 h-auto py-3"
            onClick={onAddClick}
          >
            <Plus className="h-5 w-5" />
            <span className="text-xs">Add</span>
          </Button>
          <Button
            variant="outline"
            className="flex flex-col items-center justify-center gap-2 h-auto py-3"
            onClick={onImportClick}
          >
            <Upload className="h-5 w-5" />
            <span className="text-xs">Import</span>
          </Button>
        </div>
      </div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Portfolio Summary</h2>
        {onUpdatePrices && (
          <div className="flex items-center gap-2">
            {relativeTimeText && (
              <span className="text-sm text-muted-foreground whitespace-nowrap">
                Updated {relativeTimeText}
              </span>
            )}
            <Button
              variant="outline"
              size="icon"
              onClick={onUpdatePrices}
              disabled={isUpdatingPrices}
              className="h-8 w-8"
            >
              <RefreshCw className={cn("h-4 w-4", isUpdatingPrices && "animate-spin")} />
            </Button>
          </div>
        )}
      </div>
      {/* Mobile: Total Value + Holdings in first row, Day Change + Total Return in second row */}
      <div className="md:hidden space-y-4">
        <div className="grid grid-cols-2 gap-4">
          {totalValueCard && renderCard(totalValueCard)}
          {holdingsCard && renderCard(holdingsCard)}
        </div>
        <div className="grid grid-cols-2 gap-4">
          {dayChangeCard && renderCard(dayChangeCard)}
          {totalReturnCard && renderCard(totalReturnCard)}
        </div>
      </div>
      {/* Desktop: All cards in one row */}
      <div className="hidden md:grid md:grid-cols-4 gap-4">
        {cards.map(renderCard)}
      </div>
    </div>
  );
}

