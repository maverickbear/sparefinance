"use client";

import Link from "next/link";
import { TotalBudgetsWidgetData } from "@/src/domain/dashboard/types";
import { WidgetCard } from "./widget-card";
import { ShoppingCart, UtensilsCrossed, Home, Car, Ticket, Heart, Wallet, LucideIcon, ChevronRight } from "lucide-react";

interface TotalBudgetsWidgetProps {
  data: TotalBudgetsWidgetData | null;
  className?: string;
}

export function TotalBudgetsWidget({ data, className }: TotalBudgetsWidgetProps) {
  if (!data) return null;

  const SeeAllLink = () => (
    <Link
      href="/planning/budgets"
      className="flex items-center text-sm font-medium hover:underline"
    >
      See all <ChevronRight className="ml-1 h-4 w-4" />
    </Link>
  );

  return (
    <WidgetCard
      title="Total budgets"
      className={className}
      headerAction={<SeeAllLink />}
    >
      <div className="flex flex-col h-full space-y-6">
        <div>
          <span className="text-3xl font-bold tracking-tight">
            ${data.totalAmount.toLocaleString()}
          </span>
        </div>

        {/* Allocation Bar */}
        <div className="h-4 w-full flex rounded-full overflow-hidden bg-muted">
          {data.categories.map((cat, i) => (
            <div
              key={cat.id}
              style={{ 
                width: `${cat.allocationPercentage}%`,
                backgroundColor: cat.color 
              }}
              className="h-full border-r border-background last:border-0"
            />
          ))}
        </div>

        {/* Categories List */}
        <div className="space-y-4">
          {data.categories.map((cat) => {
            const remaining = cat.budget - cat.spent;
            
            return (
              <div key={cat.id} className="flex items-start justify-between">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                     <BudgetCategoryIcon name={cat.name} color={cat.color} />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="font-medium text-sm">{cat.name}</span>
                    <span className="text-xs">
                      <span className="text-foreground">${remaining.toLocaleString()}</span>
                      <span className="text-slate-400"> left</span>
                    </span>
                  </div>
                </div>
                
                <div className="flex flex-col items-end shrink-0 w-fit">
                   <span className="text-sm">
                     <span className="text-red-500">${cat.spent.toLocaleString()}</span>
                     <span className="text-slate-400"> / ${cat.budget.toLocaleString()}</span>
                   </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </WidgetCard>
  );
}

function BudgetCategoryIcon({ name, color }: { name: string; color: string }) {
  const n = name.toLowerCase();
  let Icon: LucideIcon = Wallet;
  if (n.includes("grocer") || n.includes("shopping")) Icon = ShoppingCart;
  else if (n.includes("food") || n.includes("dining") || n.includes("restaurant")) Icon = UtensilsCrossed;
  else if (n.includes("home") || n.includes("housing") || n.includes("rent")) Icon = Home;
  else if (n.includes("transport") || n.includes("car") || n.includes("auto") || n.includes("gas")) Icon = Car;
  else if (n.includes("entertainment") || n.includes("fun") || n.includes("subscription")) Icon = Ticket;
  else if (n.includes("health") || n.includes("medical") || n.includes("personal")) Icon = Heart;
  return <Icon className="h-5 w-5" style={{ color }} />;
}
