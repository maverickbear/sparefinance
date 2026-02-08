"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Progress } from "@/components/ui/progress";
import { Target, Home, Car, Plane, ChevronRight, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { GoalsProgressWidgetData } from "@/src/domain/dashboard/types";
import { WidgetCard } from "./widget-card";
import { WidgetEmptyState } from "./widget-empty-state";

interface GoalsProgressWidgetProps {
  data: GoalsProgressWidgetData | null;
  loading?: boolean;
  error?: string | null;
  className?: string;
}

export function GoalsProgressWidget({ data, className }: GoalsProgressWidgetProps) {
  if (!data) return null;

  if (data.goals.length === 0) {
    return (
      <WidgetCard title="Goals" className={className}>
        <WidgetEmptyState
          title="Set goals"
          description="Track your savings progress"
          primaryAction={{
            label: "Create Goal",
            href: "/planning/goals",
          }}
          icon={Target}
        />
      </WidgetCard>
    );
  }

  const SeeAllLink = () => (
    <Link 
      href="/planning/goals" 
      className="flex items-center text-sm font-medium hover:underline"
    >
      See all <ChevronRight className="ml-1 h-4 w-4" />
    </Link>
  );

  return (
    <WidgetCard
      title="Goals"
      headerAction={<SeeAllLink />}
      className={className}
    >
      <div className="space-y-4">
        {data.goals.map((goal) => {
          // Identify icon based on name
          const Icon = getGoalIcon(goal.name);
          
          return (
             <div key={goal.id} className="flex flex-col space-y-2">
                <Link
                  href="/planning/goals"
                  className="flex items-center justify-between rounded-lg transition-colors hover:bg-muted/50 -mx-2 px-2 py-1"
                >
                   <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center">
                        <Icon className="h-5 w-5 text-slate-700" />
                      </div>
                      <span className="font-medium text-sm">{goal.name}</span>
                   </div>
                   
                   <div className="flex items-center gap-2">
                      <div className="text-right">
                         <span className="text-sm font-semibold">
                           ${goal.currentBalance.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                         </span>
                         <span className="text-slate-400 text-sm"> / ${goal.targetAmount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                      </div>
                   </div>
                </Link>

                <div className="flex items-center gap-4 pl-[52px]">
                   <div className="flex-1 min-w-0 h-3 bg-slate-100 rounded-full overflow-hidden">
                      <div 
                        className="h-full rounded-full transition-all duration-500"
                        style={{ 
                          width: `${Math.min(100, goal.progressPercentage)}%`,
                          backgroundColor: getGoalColor(goal.name)
                        }}
                      />
                   </div>
                </div>
             </div>
          );
        })}
      </div>
    </WidgetCard>
  );
}

function getGoalIcon(name: string) {
  const n = name.toLowerCase();
  if (n.includes("vacation") || n.includes("trip") || n.includes("travel")) return Plane;
  if (n.includes("house") || n.includes("home") || n.includes("renovation")) return Home;
  if (n.includes("car") || n.includes("vehicle") || n.includes("auto")) return Car;
  return Target;
}

function getGoalColor(name: string) {
  const n = name.toLowerCase();
  if (n.includes("vacation") || n.includes("trip")) return "#8b5cf6"; // Purple
  if (n.includes("house") || n.includes("home")) return "#22c55e"; // Green
  if (n.includes("car") || n.includes("vehicle")) return "#f97316"; // Orange
  return "#3b82f6"; // Blue
}

