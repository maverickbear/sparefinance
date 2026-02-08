"use client";

import { RecentTransactionsWidgetData } from "@/src/domain/dashboard/types";
import { WidgetCard } from "./widget-card";
import { ChevronRight, ArrowUp, ArrowDown, ArrowLeftRight } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/components/common/money";

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
          <Link
            key={tx.id}
            href="/transactions"
            className="flex items-center justify-between rounded-lg transition-colors hover:bg-muted/50 -mx-2 px-2 py-1"
          >
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center">
                <TransactionTypeIcon type={tx.type} />
              </div>
              <div className="flex flex-col">
                <span className="font-medium text-sm">{tx.name}</span>
                <span className="text-xs text-slate-400">{tx.date}</span>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
               <div className="flex flex-col items-end min-w-[80px]">
                 <span className="text-sm font-semibold text-black dark:text-foreground">
                   {formatMoney(tx.amount)}
                 </span>
               </div>
            </div>
          </Link>
        ))}
      </div>
    </WidgetCard>
  );
}

function TransactionTypeIcon({ type }: { type: 'income' | 'expense' | 'transfer' }) {
  if (type === 'income') return <ArrowUp className="h-5 w-5 text-emerald-500" />;
  if (type === 'expense') return <ArrowDown className="h-5 w-5 text-red-500" />;
  return <ArrowLeftRight className="h-5 w-5 text-slate-500" />; // transfer
}
