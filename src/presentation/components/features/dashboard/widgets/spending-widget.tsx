"use client";

import { SpendingWidgetData } from "@/src/domain/dashboard/types";
import { WidgetCard } from "./widget-card";
import { ChevronDown, PieChart, TrendingUp } from "lucide-react";
import { useState } from "react";
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart as RePieChart, Pie, Cell
} from "recharts";
import { formatMoney } from "@/components/common/money";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface SpendingWidgetProps {
  data: SpendingWidgetData | null;
  className?: string;
}

type ViewType = 'trend' | 'categories';

export function SpendingWidget({ data, className }: SpendingWidgetProps) {
  const [view, setView] = useState<ViewType>('trend');

  if (!data) return null;

  const currentSeries = data.series.find(s => s.label === "This month");
  const previousSeries = data.series.find(s => s.label === "Last month");

  // Merge data for line chart
  const chartData = currentSeries?.data.map((point, i) => {
    return {
      name: point.date,
      current: point.cumulative,
      previous: previousSeries?.data[i]?.cumulative || null, 
    };
  }) || [];

  return (
    <WidgetCard
      title="Spending this month"
      headerAction={
        <div className="flex bg-muted rounded-lg p-0.5">
          <Button 
            variant="ghost" 
            size="small" 
            className={cn(
              "h-7 px-2 text-xs hover:bg-background", 
              view === 'trend' && "bg-background shadow-sm"
            )}
            onClick={() => setView('trend')}
            title="Trend View"
          >
            <TrendingUp className="h-4 w-4" />
          </Button>
          <Button 
             variant="ghost" 
             size="small" 
             className={cn(
               "h-7 px-2 text-xs hover:bg-background", 
               view === 'categories' && "bg-background shadow-sm"
             )}
             onClick={() => setView('categories')}
             title="Category View"
          >
            <PieChart className="h-4 w-4" />
          </Button>
        </div>
      }
      className={className}
    >
      <div className="flex flex-col h-full">
        <div className="mb-4">
          <span className="text-3xl font-bold tracking-tight">
            {formatMoney(data.currentTotal)}
          </span>
        </div>

        {view === 'trend' ? (
          <>
            {/* Legend */}
            <div className="flex items-center gap-4 mb-4 text-xs">
               <div className="flex items-center gap-1.5">
                 <span className="w-2.5 h-2.5 rounded-full bg-orange-500" />
                 <span>This month</span>
               </div>
               <div className="flex items-center gap-1.5">
                 <span className="w-2.5 h-2.5 rounded-full bg-gray-500" />
                 <span>Last month</span>
               </div>
            </div>

            <div className="flex-1 w-full min-h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 12, fill: "#6B7280" }} 
                    minTickGap={30}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 12, fill: "#6B7280" }}
                    tickFormatter={(value) => `$${value}`}
                  />
                  <Tooltip 
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    formatter={(value: number) => [`$${value.toFixed(2)}`]}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="previous" 
                    stroke="#9ca3af" // Gray
                    strokeDasharray="5 5" 
                    strokeWidth={2}
                    dot={false}
                    activeDot={false}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="current" 
                    stroke="#f97316" // Orange
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4, fill: "#f97316", strokeWidth: 0 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </>
        ) : (
          /* Categories View (Donut Chart) */
          <div className="flex-1 w-full min-h-[200px] flex items-center gap-1">
             <div className="h-full w-1/2 min-h-[180px]">
               <ResponsiveContainer width="100%" height="100%">
                 <RePieChart>
                   <Pie
                     data={data.categories || []}
                     cx="50%"
                     cy="50%"
                     innerRadius={45}
                     outerRadius={70}
                     paddingAngle={2}
                     dataKey="value"
                   >
                     {(data.categories || []).map((entry, index) => (
                       <Cell key={`cell-${index}`} fill={entry.color} strokeWidth={0} />
                     ))}
                   </Pie>
                   <Tooltip 
                      formatter={(value: number) => formatMoney(value)}
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                   />
                 </RePieChart>
               </ResponsiveContainer>
             </div>
             
             <div className="w-1/2 pl-0 flex flex-col justify-center gap-3 overflow-y-auto max-h-[220px] pr-1">
                {(data.categories || []).slice(0, 5).map((category) => (
                  <div key={category.id} className="flex items-center justify-between text-xs w-full">
                    <div className="flex items-center gap-2 truncate max-w-[60%]">
                      <div 
                        className="w-2.5 h-2.5 rounded-full shrink-0" 
                        style={{ backgroundColor: category.color }}
                      />
                      <span className="truncate" title={category.name}>{category.name}</span>
                    </div>
                    <span className="font-medium">{formatMoney(category.value)}</span>
                  </div>
                ))}
                {(data.categories?.length || 0) > 5 && (
                  <div className="text-[10px] text-muted-foreground text-center pt-1 border-t">
                    + {(data.categories?.length || 0) - 5} others
                  </div>
                )}
             </div>
          </div>
        )}
      </div>
    </WidgetCard>
  );
}
