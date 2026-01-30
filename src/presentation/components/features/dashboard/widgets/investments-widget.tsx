"use client";

import { InvestmentHoldingsWidgetData } from "@/src/domain/dashboard/types";
import { WidgetCard } from "./widget-card";
import { ChevronRight, TrendingUp, TrendingDown, Bitcoin, Briefcase } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface InvestmentsWidgetProps {
  data: InvestmentHoldingsWidgetData | null;
  className?: string;
}

export function InvestmentsWidget({ data, className }: InvestmentsWidgetProps) {
  if (!data) return null;

  const SeeAllLink = () => (
    <Link 
      href={data.actions[0]?.href || "/investments"} 
      className="flex items-center text-sm font-medium hover:underline"
    >
      See all <ChevronRight className="ml-1 h-4 w-4" />
    </Link>
  );

  return (
    <WidgetCard
      title="Investments"
      headerAction={<SeeAllLink />}
      className={className}
    >
      <div className="space-y-4">
        {data.holdings.map((holding) => {
          const isPositive = holding.change >= 0;
          
          return (
            <div key={holding.symbol} className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-slate-50 flex items-center justify-center">
                  <StockIcon symbol={holding.symbol} />
                </div>
                <div className="flex flex-col">
                   {/* Name and Symbol */}
                   <span className="font-medium text-sm">{holding.symbol} <span className="text-muted-foreground font-normal">({holding.name})</span></span>
                </div>
              </div>
              
              <div className="flex items-center gap-6">
                 {/* Value */}
                 <span className="font-bold text-sm">
                   ${holding.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                 </span>

                 {/* Badge */}
                 <span className={cn(
                   "px-2 py-0.5 rounded text-xs font-medium flex items-center",
                   isPositive ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
                 )}>
                   {isPositive ? "+" : ""}{holding.change.toFixed(1)}%
                 </span>

                 {/* Optional: Cost basis or just total value? Design shows just one big number and badge */}
                 {/* In design: $1,600.00 +21.9% | $1,950.00 */}
                 {/* Wait, the design has THREE columns on the right. 
                     Item 1: $1,600.00 (Current Value?)
                     Item 2: +21.9% (Badge)
                     Item 3: $1,950.00 (Maybe Target? Or Gain? Or Cost?)
                     Let's Assume: Current Value | Change % | Cost Basis? Or Day Change?
                     Let's stick to Value + Change for MVP unless I have more datapoints.
                  */}
              </div>
            </div>
          );
        })}
      </div>
    </WidgetCard>
  );
}

function StockIcon({ symbol }: { symbol: string }) {
  const s = symbol.toLowerCase();
  if (s === 'btc' || s === 'eth' || s.includes('coin')) return <Bitcoin className="h-5 w-5 text-orange-500" />;
  if (s === 'aapl') return <Briefcase className="h-5 w-5 text-slate-800" />; // Should be Apple logo in real app, generic fallback
  if (s === 'tsla') return <Briefcase className="h-5 w-5 text-red-600" />;
  return <Briefcase className="h-5 w-5 text-slate-500" />;
}
