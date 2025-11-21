"use client";

import { BarChart3, TrendingUp } from "lucide-react";

export function ReportsAnalyticsMockup() {
  return (
    <div className="relative w-full h-full flex items-center justify-center">
      <div className="w-full max-w-[300px]">
        {/* Chart Card */}
        <div className="bg-card  rounded-xl p-4 ">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-semibold">Spending by Category</p>
            <BarChart3 className="w-4 h-4 text-muted-foreground" />
          </div>
          
          {/* Simple Bar Chart */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs w-20 text-muted-foreground">Food</span>
              <div className="flex-1 bg-muted rounded-full h-3">
                <div className="bg-blue-600 h-3 rounded-full" style={{ width: "65%" }} />
              </div>
              <span className="text-xs font-semibold w-12 text-right">65%</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs w-20 text-muted-foreground">Transport</span>
              <div className="flex-1 bg-muted rounded-full h-3">
                <div className="bg-green-600 h-3 rounded-full" style={{ width: "25%" }} />
              </div>
              <span className="text-xs font-semibold w-12 text-right">25%</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs w-20 text-muted-foreground">Entertain</span>
              <div className="flex-1 bg-muted rounded-full h-3">
                <div className="bg-purple-600 h-3 rounded-full" style={{ width: "10%" }} />
              </div>
              <span className="text-xs font-semibold w-12 text-right">10%</span>
            </div>
          </div>

          {/* Trend Indicator */}
          <div className="mt-4 flex items-center gap-2 text-xs">
            <TrendingUp className="w-4 h-4 text-green-600" />
            <span className="text-muted-foreground">12% increase vs last month</span>
          </div>
        </div>
      </div>
    </div>
  );
}

