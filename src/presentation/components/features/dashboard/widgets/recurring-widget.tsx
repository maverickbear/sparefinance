"use client";

import { RecurringWidgetData } from "@/src/domain/dashboard/types";
import { WidgetCard } from "./widget-card";
import { ChevronRight, RefreshCw, Music, MonitorPlay, MessageSquare, Calendar } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface RecurringWidgetProps {
  data: RecurringWidgetData | null;
  className?: string;
}

export function RecurringWidget({ data, className }: RecurringWidgetProps) {
  if (!data) return null;

  const SeeAllLink = () => (
    <Link 
      href="/planned-payment" 
      className="flex items-center text-sm font-medium hover:underline"
    >
      See all <ChevronRight className="ml-1 h-4 w-4" />
    </Link>
  );

  return (
    <WidgetCard
      title="Planned Payments"
      headerAction={<SeeAllLink />} 
      className={className}
    >
      <div className="space-y-4">
        {data.items.map((item) => (
          <div key={item.id} className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-slate-50 flex items-center justify-center p-2">
                <ServiceIcon name={item.name} />
              </div>
              <span className="font-medium text-sm">{item.name}</span>
            </div>
            
            <div className="flex items-center gap-4">
               {/* Frequency badge */}
               <span className="px-2 py-1 rounded text-xs font-medium bg-slate-100 text-slate-600 hidden sm:inline-block">
                 {item.frequency}
               </span>

               <span className="font-bold text-sm">
                 ${item.amount.toFixed(2)}
               </span>
               
               <span className="text-xs text-muted-foreground flex items-center gap-1 min-w-[60px] justify-end">
                 <Calendar className="h-3.5 w-3.5 shrink-0" aria-hidden />
                 {item.nextDate}
               </span>
               
               <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </div>
          </div>
        ))}
      </div>
    </WidgetCard>
  );
}

function ServiceIcon({ name }: { name: string }) {
  const n = name.toLowerCase();
  // Simple brand detection
  if (n.includes("spotify")) return <Music className="h-5 w-5 text-green-500" />;
  if (n.includes("netflix") || n.includes("youtube")) return <MonitorPlay className="h-5 w-5 text-red-500" />;
  if (n.includes("chatgpt") || n.includes("openai")) return <MessageSquare className="h-5 w-5 text-emerald-600" />;
  return <RefreshCw className="h-5 w-5 text-slate-400" />;
}
