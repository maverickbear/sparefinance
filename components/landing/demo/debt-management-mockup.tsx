"use client";

import { CreditCard, TrendingDown } from "lucide-react";

export function DebtManagementMockup() {
  return (
    <div className="relative w-full h-full flex items-center justify-center">
      <div className="w-full max-w-[280px]">
        {/* Debt Card */}
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-sentiment-negative/10 flex items-center justify-center">
                <CreditCard className="w-4 h-4 text-sentiment-negative" />
              </div>
              <p className="text-sm font-semibold">Credit Card</p>
            </div>
            <TrendingDown className="w-4 h-4 text-sentiment-positive" />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Current Balance</span>
              <span className="text-lg font-bold">$3,500</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Original</span>
              <span className="text-muted-foreground line-through">$5,000</span>
            </div>
            <div className="w-full bg-muted rounded-full h-2 mt-2">
              <div className="bg-sentiment-positive h-2 rounded-full" style={{ width: "30%" }} />
            </div>
            <p className="text-xs text-sentiment-positive font-medium mt-1">30% paid off</p>
          </div>
        </div>
      </div>
    </div>
  );
}

