"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatMoney } from "@/components/common/money";
import { format } from "date-fns";

interface Order {
  id: string;
  symbol: string;
  side: string;
  orderType: string;
  state: string;
  totalQuantity: number;
  openQuantity: number;
  filledQuantity: number;
  limitPrice: number | null;
  avgExecPrice: number | null;
  creationTime: string;
  account?: {
    name: string;
    questradeAccountNumber: string;
  };
  security?: {
    symbol: string;
    name: string;
  };
}

interface OrdersMobileCardProps {
  order: Order;
}

export function OrdersMobileCard({ order }: OrdersMobileCardProps) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="space-y-3">
          {/* Header with Symbol and State */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-lg font-semibold">{order.security?.symbol || order.symbol}</span>
                <Badge 
                  variant="outline" 
                  className={`text-[10px] px-2 py-1 ${
                    order.state.toLowerCase() === "executed" || order.state.toLowerCase() === "final"
                      ? "bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400"
                      : order.state.toLowerCase() === "pending" || order.state.toLowerCase() === "accepted" || order.state.toLowerCase() === "queued"
                      ? "bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400"
                      : order.state.toLowerCase() === "rejected" || order.state.toLowerCase() === "canceled"
                      ? "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400"
                      : "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400"
                  }`}
                >
                  {order.state}
                </Badge>
              </div>
              {order.security?.name && (
                <p className="text-sm text-muted-foreground mt-1 line-clamp-1">
                  {order.security.name}
                </p>
              )}
            </div>
            <div className="flex items-center gap-1">
              <span className={`rounded-[12px] px-2 py-1 text-xs ${
                order.side.toLowerCase() === "buy" 
                  ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" 
                  : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
              }`}>
                {order.side}
              </span>
            </div>
          </div>

          {/* Date and Account */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Date</span>
              <span className="text-sm font-medium">{format(new Date(order.creationTime), "MMM dd, yyyy")}</span>
              <span className="text-[10px] text-muted-foreground mt-0.5">
                {format(new Date(order.creationTime), "HH:mm")}
              </span>
            </div>
            {order.account?.name && (
              <div className="flex flex-col">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Account</span>
                <span className="text-sm font-medium">{order.account.name}</span>
              </div>
            )}
          </div>

          {/* Quantity */}
          <div className="grid grid-cols-3 gap-3 pt-2 border-t">
            <div className="flex flex-col">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Total</span>
              <span className="text-sm font-medium">{order.totalQuantity}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Open</span>
              <span className="text-sm font-medium">{order.openQuantity}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Filled</span>
              <span className="text-sm font-medium">{order.filledQuantity}</span>
            </div>
          </div>

          {/* Prices */}
          <div className="grid grid-cols-2 gap-3 pt-2 border-t">
            {order.limitPrice && (
              <div className="flex flex-col">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Limit Price</span>
                <span className="text-sm font-medium">{formatMoney(order.limitPrice)}</span>
              </div>
            )}
            {order.avgExecPrice && (
              <div className="flex flex-col">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Avg Price</span>
                <span className="text-sm font-medium">{formatMoney(order.avgExecPrice)}</span>
              </div>
            )}
          </div>

          {/* Order Type */}
          <div className="flex flex-col pt-2 border-t">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Type</span>
            <span className="text-sm font-medium">{order.orderType}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

