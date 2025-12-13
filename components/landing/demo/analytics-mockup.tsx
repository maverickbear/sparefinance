"use client";

import { Button } from '@/components/ui/button';

export function AnalyticsMockup() {
  return (
    <div className="relative w-full h-full flex items-center justify-center">
      <div className="w-full max-w-[240px] bg-card border border-border rounded-2xl p-4 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-semibold">Activity</p>
          <select className="text-xs border border-border rounded px-2 py-1 bg-background">
            <option>Month</option>
          </select>
        </div>
        
        {/* Circular Progress Chart */}
        <div className="relative w-32 h-32 mx-auto mb-4">
          <svg className="w-32 h-32 transform -rotate-90">
            <circle
              cx="64"
              cy="64"
              r="56"
              fill="none"
              stroke="hsl(var(--muted))"
              strokeWidth="12"
            />
            <circle
              cx="64"
              cy="64"
              r="56"
              fill="none"
              stroke="hsl(var(--primary))"
              strokeWidth="12"
              strokeDasharray={`${2 * Math.PI * 56}`}
              strokeDashoffset={`${2 * Math.PI * 56 * 0.25}`}
              className="transition-all"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-2xl font-bold">75%</p>
          </div>
        </div>

        {/* Legend */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-primary"></div>
            <p className="text-xs text-muted-foreground">Daily payment <span className="font-semibold text-foreground">55%</span></p>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-primary/40"></div>
            <p className="text-xs text-muted-foreground">Hobby <span className="font-semibold text-foreground">20%</span></p>
          </div>
        </div>

        <Button variant="outline" size="medium" className="w-full mt-4">
          View all activity →
        </Button>
      </div>
    </div>
  );
}

