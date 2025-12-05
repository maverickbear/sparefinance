"use client";

import { Sparkles, CheckCircle2 } from "lucide-react";

export function CategorizationMockup() {
  return (
    <div className="relative w-full h-full flex items-center justify-center">
      <div className="w-full max-w-[280px] space-y-2">
        {/* Transaction 1 */}
        <div className="bg-card border border-border rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold">Starbucks Coffee</p>
            <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
              <Sparkles className="w-3 h-3 text-primary" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded-full">Food & Dining</span>
            <span className="text-xs text-muted-foreground">95%</span>
          </div>
        </div>

        {/* Transaction 2 */}
        <div className="bg-card border border-border rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold">Uber Ride</p>
            <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
              <Sparkles className="w-3 h-3 text-primary" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded-full">Transportation</span>
            <span className="text-xs text-muted-foreground">98%</span>
          </div>
        </div>

        {/* Auto-categorized indicator */}
        <div className="flex items-center gap-2 text-xs text-green-600 dark:text-green-400 pt-1">
          <CheckCircle2 className="w-4 h-4" />
          <span>Auto-categorized</span>
        </div>
      </div>
    </div>
  );
}

