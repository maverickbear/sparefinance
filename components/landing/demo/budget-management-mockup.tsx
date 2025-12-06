"use client";

import { Target } from "lucide-react";

export function BudgetManagementMockup() {
  return (
    <div className="relative w-full h-full flex items-center justify-center">
      <div className="w-full max-w-[280px]">
        {/* Budget Card */}
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-interactive-primary/10 flex items-center justify-center">
                <Target className="w-4 h-4 text-interactive-primary" />
              </div>
              <p className="text-sm font-semibold">Food & Dining</p>
            </div>
            <p className="text-xs text-muted-foreground">75%</p>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Budget</span>
              <span className="font-semibold">$1,600</span>
            </div>
            <div className="w-full bg-muted rounded-full h-2">
              <div className="bg-interactive-primary h-2 rounded-full" style={{ width: "75%" }} />
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Spent</span>
              <span className="font-semibold">$1,200</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

