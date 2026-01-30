"use client";

import { SubscriptionsWidgetData } from "@/src/domain/dashboard/types";
import { WidgetCard } from "./widget-card";
import { ChevronRight, RefreshCw, Music, MonitorPlay, MessageSquare, Zap } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface SubscriptionsWidgetProps {
  data: SubscriptionsWidgetData | null;
  className?: string;
}

export function SubscriptionsWidget({ data, className }: SubscriptionsWidgetProps) {
  if (!data) return null;

  const SeeAllLink = () => (
    <Link 
      href="/planning/subscriptions" 
      className="flex items-center text-sm font-medium hover:underline"
    >
      See all <ChevronRight className="ml-1 h-4 w-4" />
    </Link>
  );

  return (
    <WidgetCard
      title="Subscriptions"
      headerAction={<SeeAllLink />} 
      className={className}
    >
      <div className="space-y-4">
        <div className="flex items-baseline justify-between border-b border-border pb-3">
             <span className="text-sm text-muted-foreground">Monthly Total</span>
             <span className="text-2xl font-bold">${data.totalMonthly.toFixed(2)}</span>
        </div>

        {data.items.length === 0 ? (
          <div className="py-4 text-center text-sm text-muted-foreground">
            No active subscriptions found.
          </div>
        ) : (
          data.items.map((item) => (
          <div key={item.id} className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-slate-50 flex items-center justify-center p-2 overflow-hidden shadow-sm border border-slate-100">
                {item.logo ? (
                  <img src={item.logo} alt={item.name} className="h-full w-full object-cover" />
                ) : (
                  <ServiceIcon name={item.name} />
                )}
              </div>
              <span className="font-medium text-sm truncate max-w-[100px] sm:max-w-[140px]">{item.name}</span>
            </div>
            
            <div className="flex items-center gap-3">
               <span className="text-xs text-muted-foreground hidden sm:inline-block">
                 {item.nextDate}
               </span>

               <span className="font-bold text-sm">
                 ${item.amount.toFixed(2)}
               </span>
               <span className="text-[10px] text-muted-foreground uppercase bg-slate-100 px-1.5 py-0.5 rounded">
                 {item.frequency === 'Monthly' ? 'MO' : 'YR'}
               </span>
            </div>
          </div>
        ))
        )}
      </div>
    </WidgetCard>
  );
}

function ServiceIcon({ name }: { name: string }) {
  const n = name.toLowerCase();
  // Simple brand detection
  if (n.includes("spotify")) return <Music className="h-5 w-5 text-green-500" />;
  if (n.includes("netflix") || n.includes("youtube") || n.includes("hulu") || n.includes("disney")) return <MonitorPlay className="h-5 w-5 text-red-500" />;
  if (n.includes("chatgpt") || n.includes("openai") || n.includes("claude")) return <MessageSquare className="h-5 w-5 text-emerald-600" />;
  if (n.includes("aws") || n.includes("google") || n.includes("azure")) return <Zap className="h-5 w-5 text-yellow-500" />;
  return <RefreshCw className="h-5 w-5 text-slate-400" />;
}
