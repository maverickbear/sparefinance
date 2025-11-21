"use client";

export function BenefitsActivityCard() {
  return (
    <div className="bg-card border border-border rounded-2xl p-6">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-semibold">Activity</p>
        <p className="text-xs text-muted-foreground">Month</p>
      </div>
      
      {/* Circular Progress Chart */}
      <div className="relative w-40 h-40 mx-auto mb-6">
        <svg className="w-40 h-40 transform -rotate-90">
          <circle
            cx="80"
            cy="80"
            r="70"
            fill="none"
            stroke="hsl(var(--muted))"
            strokeWidth="16"
          />
          <circle
            cx="80"
            cy="80"
            r="70"
            fill="none"
            stroke="hsl(var(--primary))"
            strokeWidth="16"
            strokeDasharray={`${2 * Math.PI * 70}`}
            strokeDashoffset={`${2 * Math.PI * 70 * 0.25}`}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <p className="text-3xl font-bold">75%</p>
        </div>
      </div>

      {/* Legend */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full bg-primary"></div>
          <p className="text-sm text-muted-foreground">Daily payment <span className="font-semibold text-foreground">55%</span></p>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full bg-primary/40"></div>
          <p className="text-sm text-muted-foreground">Hobby <span className="font-semibold text-foreground">20%</span></p>
        </div>
      </div>

      <div className="w-full mt-6 text-sm border border-border rounded-lg py-2.5 flex items-center justify-center gap-2">
        View all activity
        <span>→</span>
      </div>
    </div>
  );
}

