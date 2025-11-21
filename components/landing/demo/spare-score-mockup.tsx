"use client";

import { cn } from "@/lib/utils";

export function SpareScoreMockup() {
  const score = 85;
  const classification = "Excellent";
  const indicatorPosition = 85; // Position on the gauge (0-100)

  const getScoreColor = (score: number) => {
    if (score >= 91) return "text-green-600";
    if (score >= 81) return "text-green-600";
    if (score >= 71) return "text-yellow-600";
    if (score >= 61) return "text-orange-600";
    return "text-red-600";
  };

  const getClassificationText = (score: number) => {
    if (score >= 91) return "Excellent";
    if (score >= 81) return "Good";
    if (score >= 71) return "Fair";
    if (score >= 61) return "Poor";
    return "Critical";
  };

  return (
    <div className="relative w-full h-full flex items-center justify-center">
      <div className="w-full max-w-[280px] bg-card  rounded-2xl p-4  flex flex-col h-full">
        {/* Header */}
        <div className="mb-2.5">
          <h3 className="text-sm font-semibold mb-0.5">Spare Score</h3>
          <p className="text-[10px] text-muted-foreground leading-tight">Combined view of spending, savings and debt</p>
        </div>

        {/* Score Display */}
        <div className="mb-2.5">
          <div className={cn("text-3xl font-bold tabular-nums leading-none", getScoreColor(score))}>
            {score}
          </div>
          <div className="text-xs font-medium text-foreground mt-0.5">
            {getClassificationText(score)}
          </div>
        </div>

        {/* Horizontal Gauge */}
        <div className="relative mb-2.5 flex-shrink-0">
          {/* Indicator pointer - above bar */}
          <div 
            className="absolute -top-1.5 -translate-x-1/2 transition-all duration-500 z-10"
            style={{ left: `${indicatorPosition}%` }}
          >
            <svg width="12" height="8" viewBox="0 0 14 10" className="text-foreground drop-shadow-sm">
              <path d="M7 10L0 0h14L7 10z" fill="currentColor" />
            </svg>
          </div>
          
          {/* Gradient bar */}
          <div className="relative h-3 rounded-lg overflow-hidden /50">
            <div className="absolute inset-0" style={{
              background: 'linear-gradient(to right, #ef4444 0%, #fb923c 50%, #22c55e 100%)'
            }}></div>
          </div>
          
          {/* Scale markers */}
          <div className="relative mt-1">
            <div className="flex justify-between">
              <span className="text-[10px] text-muted-foreground font-medium">0</span>
              <span className="text-[10px] text-muted-foreground font-medium">25</span>
              <span className="text-[10px] text-muted-foreground font-medium">50</span>
              <span className="text-[10px] text-muted-foreground font-medium">75</span>
              <span className="text-[10px] text-muted-foreground font-medium">100</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

