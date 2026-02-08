"use client";

import { SubscriptionsWidgetData } from "@/src/domain/dashboard/types";
import { WidgetCard } from "./widget-card";
import { ChevronRight, RefreshCw, Music, MonitorPlay, MessageSquare, Zap } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/components/common/money";

interface SubscriptionsWidgetProps {
  data: SubscriptionsWidgetData | null;
  className?: string;
}

export function SubscriptionsWidget({ data, className }: SubscriptionsWidgetProps) {
  if (!data) return null;

  const SeeAllLink = () => (
    <Link 
      href="/subscriptions" 
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
             <span className="text-2xl font-bold">{formatMoney(data.totalMonthly)}</span>
        </div>

        {data.items.length === 0 ? (
          <div className="py-4 text-center text-sm text-muted-foreground">
            No active subscriptions found.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {data.items.map((item) => (
              <Link
                key={item.id}
                href="/subscriptions"
                className="flex flex-col rounded-lg border border-border bg-muted/30 p-3 transition-colors hover:bg-muted/50"
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className="h-9 w-9 shrink-0 rounded-full bg-slate-100 flex items-center justify-center p-1.5 overflow-hidden border border-slate-100">
                    {item.logo ? (
                      <img src={item.logo} alt={item.name} className="h-full w-full object-cover" />
                    ) : (
                      <ServiceIcon name={item.name} />
                    )}
                  </div>
                  <span className="font-medium text-sm truncate min-w-0">{item.name}</span>
                </div>
                <span className="text-xs text-slate-400 mb-1">{item.frequency ?? "—"}</span>
                <span className="text-sm font-semibold">{formatMoney(item.amount)}</span>
              </Link>
            ))}
          </div>
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
