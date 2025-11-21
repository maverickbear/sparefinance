"use client";

import { Car, Home } from "lucide-react";

export function SavingsGoalsMockup() {
  return (
    <div className="relative w-full h-full flex items-center justify-center">
      <div className="w-full max-w-[300px] space-y-3">
        {/* Car Goal Card */}
        <div className="bg-card border border-border rounded-xl p-3 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Car className="w-4 h-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold mb-0.5">Buying Car</p>
              <p className="text-xs text-muted-foreground mb-1.5">10.02.2024</p>
              <div className="flex items-baseline gap-2">
                <p className="text-xl font-bold">$13,500</p>
                <p className="text-xs text-green-600 font-medium">+$1,500</p>
              </div>
            </div>
          </div>
        </div>

        {/* House Goal Card */}
        <div className="bg-card border border-border rounded-xl p-3 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Home className="w-4 h-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold mb-0.5">House Savings</p>
              <p className="text-xs text-muted-foreground mb-1.5">10.02.2024</p>
              <div className="flex items-baseline gap-2">
                <p className="text-xl font-bold">$237,000</p>
                <p className="text-xs text-green-600 font-medium">+$14,000</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

