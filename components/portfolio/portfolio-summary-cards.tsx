"use client";

import { formatMoney } from "@/components/common/money";
import { TrendingUp, TrendingDown, Wallet, BarChart3, Plus, Upload, Plug, RefreshCw } from "lucide-react";
import { PortfolioSummary } from "@/lib/api/portfolio";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { IntegrationDropdown } from "@/components/banking/integration-dropdown";

interface PortfolioSummaryCardsProps {
  summary: PortfolioSummary;
  onAddClick?: () => void;
  onImportClick?: () => void;
  integrationProps?: {
    onSync?: () => void;
    onDisconnect?: () => void;
    onSuccess?: () => void;
  };
  onUpdatePrices?: () => void;
  isUpdatingPrices?: boolean;
}

export function PortfolioSummaryCards({ 
  summary,
  onAddClick,
  onImportClick,
  integrationProps,
  onUpdatePrices,
  isUpdatingPrices = false,
}: PortfolioSummaryCardsProps) {

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
          {integrationProps && (
            <IntegrationDropdown
              {...integrationProps}
              customTrigger={
                <Button
                  variant="outline"
                  className="flex flex-col items-center justify-center gap-2 h-auto py-3 w-full"
                >
                  <Plug className="h-5 w-5" />
                  <span className="text-xs">Integration</span>
                </Button>
              }
            />
          )}
        </div>
      </div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Portfolio Summary</h2>
        {onUpdatePrices && (
          <Button
            variant="outline"
            size="icon"
            onClick={onUpdatePrices}
            disabled={isUpdatingPrices}
            className="h-8 w-8"
          >
            <RefreshCw className={cn("h-4 w-4", isUpdatingPrices && "animate-spin")} />
          </Button>
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

