"use client";

import { TrendingUp, TrendingDown } from "lucide-react";

export function InvestmentPortfolioMockup() {
  return (
    <div className="relative w-full h-full flex items-center justify-center">
      <div className="w-full max-w-[280px]">
        {/* Portfolio Card */}
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold">Total Portfolio</p>
            <TrendingUp className="w-4 h-4 text-green-600" />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Current Value</span>
              <span className="text-lg font-bold">$25,000</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Gain/Loss</span>
              <span className="text-green-600 font-semibold">+$2,500 (+11%)</span>
            </div>
            <div className="w-full bg-muted rounded-full h-2 mt-2">
              <div className="bg-green-600 h-2 rounded-full" style={{ width: "55%" }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

