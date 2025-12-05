"use client";

import { cn } from "@/lib/utils";

export function SpareScoreMockup() {
  const score = 85;
  const classification = "Good";

  // Spare Score levels with ranges and colors
  const scoreLevels = [
    { range: "91-100", label: "Excellent", min: 91, max: 100, color: "hsl(var(--sentiment-positive))", bgColor: "bg-[hsl(var(--sentiment-positive))]" },
    { range: "81-90", label: "Good", min: 81, max: 90, color: "#94DD78", bgColor: "bg-[#94DD78]" },
    { range: "71-80", label: "Fair", min: 71, max: 80, color: "hsl(var(--sentiment-warning))", bgColor: "bg-[hsl(var(--sentiment-warning))]" },
    { range: "61-70", label: "Poor", min: 61, max: 70, color: "#FF8C42", bgColor: "bg-[#FF8C42]" },
    { range: "0-60", label: "Critical", min: 0, max: 60, color: "hsl(var(--sentiment-negative))", bgColor: "bg-[hsl(var(--sentiment-negative))]" },
  ];

  const getScoreColor = (score: number) => {
    if (score >= 91) return "text-[hsl(var(--sentiment-positive))]";
    if (score >= 81) return "text-[#94DD78]";
    if (score >= 71) return "text-[hsl(var(--sentiment-warning))]";
    if (score >= 61) return "text-[#FF8C42]";
    return "text-[hsl(var(--sentiment-negative))]";
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
      <div className="w-full max-w-[280px] bg-card rounded-2xl p-4 flex flex-col h-full">
        {/* Header */}
        <div className="mb-2.5">
          <h3 className="text-sm font-semibold mb-0.5">Spare Score</h3>
          <p className="text-[10px] text-muted-foreground leading-tight">Combined view of spending, savings and debt</p>
        </div>

        {/* Score Display with Legend */}
        <div className="mb-2.5">
          <div className="flex items-start gap-3">
            {/* Score Number */}
            <div className="flex-shrink-0">
              <div className={cn("text-3xl font-bold tabular-nums leading-none", getScoreColor(score))}>
                {score}
              </div>
              <div className="text-xs font-medium text-foreground mt-0.5">
                {getClassificationText(score)}
              </div>
            </div>

            {/* Legend with score ranges - Two columns */}
            <div className="flex-1 pt-0.5">
              <div className="grid grid-cols-2 gap-x-2 gap-y-1">
                {scoreLevels.map((level) => (
                  <div key={level.label} className="flex flex-col">
                    <span className="text-sm font-semibold text-foreground">
                      {level.label}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {level.range}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

