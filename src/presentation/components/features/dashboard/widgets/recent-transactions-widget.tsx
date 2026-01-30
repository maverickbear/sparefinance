"use client";

import { RecentTransactionsWidgetData } from "@/src/domain/dashboard/types";
import { WidgetCard } from "./widget-card";
import { ChevronRight, ShoppingBag, Coffee, Gift, Home } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface RecentTransactionsWidgetProps {
  data: RecentTransactionsWidgetData | null;
  className?: string;
}

export function RecentTransactionsWidget({ data, className }: RecentTransactionsWidgetProps) {
  if (!data) return null;

  const SeeAllLink = () => (
    <Link 
      href="/transactions" 
      className="flex items-center text-sm font-medium hover:underline"
    >
      See all <ChevronRight className="ml-1 h-4 w-4" />
    </Link>
  );

  return (
    <WidgetCard
      title="Transactions"
      headerAction={<SeeAllLink />}
      className={className}
    >
      <div className="space-y-4">
        {data.transactions.map((tx) => (
          <div key={tx.id} className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center">
                {/* Simple icon mapping based on category for visual fidelity to design */}
                <TransactionIcon category={tx.category} />
              </div>
              <div className="flex flex-col">
                <span className="font-medium text-sm">{tx.name}</span>
                {/* Badges for category */}
                {/* Design shows badges on the right side next to amount? No, badges seem to be category name inside a pill */}
              </div>
            </div>
            
            <div className="flex items-center gap-4">
               {/* Category Badge - hidden on mobile if too tight? */}
               <span className={cn(
                 "px-2 py-1 rounded text-xs font-medium hidden sm:inline-block",
                 "bg-slate-100 text-slate-600" // Default gray pill
               )}>
                 {tx.category}
               </span>

               <div className="flex flex-col items-end min-w-[80px]">
                 <span className={cn(
                   "font-medium text-sm",
                   tx.type === 'income' ? "text-emerald-500" : "text-pink-500"
                 )}>
                   {tx.type === 'income' ? '+' : '-'}${tx.amount.toFixed(2)}
                 </span>
                 <span className="text-xs text-muted-foreground flex items-center">
                   <span className="mr-1">📅</span> {tx.date}
                 </span>
               </div>
               
               <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </div>
          </div>
        ))}
      </div>
    </WidgetCard>
  );
}

function TransactionIcon({ category }: { category: string }) {
  const c = category.toLowerCase();
  if (c.includes("grocer")) return <ShoppingBag className="h-5 w-5 text-orange-500" />;
  if (c.includes("coffee") || c.includes("food")) return <Coffee className="h-5 w-5 text-amber-700" />;
  if (c.includes("gift")) return <Gift className="h-5 w-5 text-pink-500" />;
  if (c.includes("house") || c.includes("home")) return <Home className="h-5 w-5 text-indigo-500" />;
  return <ShoppingBag className="h-5 w-5 text-slate-500" />;
}
