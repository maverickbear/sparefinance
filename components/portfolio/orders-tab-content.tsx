"use client";

import { useState, useEffect } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2 } from "lucide-react";
import { formatMoney } from "@/components/common/money";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { OrdersMobileCard } from "./orders-mobile-card";

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
  stopPrice: number | null;
  avgExecPrice: number | null;
  creationTime: string;
  updateTime: string;
  account?: {
    name: string;
    questradeAccountNumber: string;
  };
  security?: {
    symbol: string;
    name: string;
  };
}

export function OrdersTabContent() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadOrders();
  }, []);

  async function loadOrders() {
    try {
      setLoading(true);
      const response = await fetch("/api/questrade/orders");
      if (response.ok) {
        const data = await response.json();
        setOrders(data.orders || []);
      }
    } catch (error) {
      console.error("Error loading orders:", error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4 md:space-y-6">
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <h2 className="text-2xl font-semibold tracking-tight">Orders</h2>
          {/* Mobile Card View */}
          <div className="lg:hidden space-y-3">
            {orders.length === 0 ? (
              <div className="flex items-center justify-center min-h-[400px] w-full">
                <div className="text-center text-muted-foreground">
                  No orders found.
                </div>
              </div>
            ) : (
              orders.map((order) => (
                <OrdersMobileCard key={order.id} order={order} />
              ))
            )}
          </div>

          {/* Desktop/Tablet Table View */}
          <div className="hidden lg:block rounded-[12px] border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs md:text-sm">Date</TableHead>
                  <TableHead className="text-xs md:text-sm hidden md:table-cell">Account</TableHead>
                  <TableHead className="text-xs md:text-sm">Security</TableHead>
                  <TableHead className="text-xs md:text-sm">Side</TableHead>
                  <TableHead className="text-xs md:text-sm hidden lg:table-cell">Type</TableHead>
                  <TableHead className="text-xs md:text-sm">State</TableHead>
                  <TableHead className="text-xs md:text-sm text-right">Quantity</TableHead>
                  <TableHead className="text-xs md:text-sm text-right hidden xl:table-cell">Open</TableHead>
                  <TableHead className="text-xs md:text-sm text-right hidden xl:table-cell">Filled</TableHead>
                  <TableHead className="text-xs md:text-sm text-right hidden lg:table-cell">Limit Price</TableHead>
                  <TableHead className="text-xs md:text-sm text-right hidden lg:table-cell">Avg Price</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={11} className="p-0">
                      <div className="flex items-center justify-center min-h-[400px] w-full">
                        <div className="text-center text-muted-foreground">
                          No orders found.
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  orders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="font-medium text-xs md:text-sm whitespace-nowrap">
                        <div className="flex flex-col gap-0.5">
                          <span>{format(new Date(order.creationTime), "MMM dd, yyyy")}</span>
                          <span className="text-[10px] text-muted-foreground">
                            {format(new Date(order.creationTime), "HH:mm")}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs md:text-sm hidden md:table-cell">
                        {order.account?.name || "-"}
                      </TableCell>
                      <TableCell className="font-medium text-xs md:text-sm">
                        <div className="flex flex-col gap-0.5">
                          <span className="font-semibold">{order.security?.symbol || order.symbol}</span>
                          {order.security?.name && (
                            <span className="text-[10px] text-muted-foreground hidden lg:block">
                              {order.security.name}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <span className={`rounded-[12px] px-1.5 md:px-2 py-0.5 md:py-1 text-[10px] md:text-xs ${
                            order.side.toLowerCase() === "buy" 
                              ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" 
                              : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                          }`}>
                            {order.side}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs md:text-sm hidden lg:table-cell">{order.orderType}</TableCell>
                      <TableCell className="text-xs md:text-sm">
                        <Badge 
                          variant="outline" 
                          className={`text-[10px] px-1.5 py-0.5 ${
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
                      </TableCell>
                      <TableCell className="text-right font-medium text-xs md:text-sm">
                        {order.totalQuantity}
                      </TableCell>
                      <TableCell className="text-right font-medium text-xs md:text-sm hidden xl:table-cell">
                        {order.openQuantity}
                      </TableCell>
                      <TableCell className="text-right font-medium text-xs md:text-sm hidden xl:table-cell">
                        {order.filledQuantity}
                      </TableCell>
                      <TableCell className="text-right font-medium text-xs md:text-sm hidden lg:table-cell">
                        {order.limitPrice ? formatMoney(order.limitPrice) : "-"}
                      </TableCell>
                      <TableCell className="text-right font-medium text-xs md:text-sm hidden lg:table-cell">
                        {order.avgExecPrice ? formatMoney(order.avgExecPrice) : "-"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
}

