"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

interface Execution {
  id: string;
  symbol: string;
  side: string;
  quantity: number;
  price: number;
  timestamp: string;
  totalCost: number;
  commission: number;
  executionFee: number;
  venue: string;
  orderId: number;
  account?: {
    name: string;
    questradeAccountNumber: string;
  };
  security?: {
    symbol: string;
    name: string;
  };
}

export function ExecutionsTabContent() {
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadExecutions();
  }, []);

  async function loadExecutions() {
    try {
      setLoading(true);
      const response = await fetch("/api/questrade/executions");
      if (response.ok) {
        const data = await response.json();
        setExecutions(data.executions || []);
      }
    } catch (error) {
      console.error("Error loading executions:", error);
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
        <Card>
          <CardHeader>
            <CardTitle>Executions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-[12px] border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs md:text-sm">Date/Time</TableHead>
                    <TableHead className="text-xs md:text-sm hidden md:table-cell">Account</TableHead>
                    <TableHead className="text-xs md:text-sm">Security</TableHead>
                    <TableHead className="text-xs md:text-sm">Side</TableHead>
                    <TableHead className="text-xs md:text-sm text-right">Quantity</TableHead>
                    <TableHead className="text-xs md:text-sm text-right">Price</TableHead>
                    <TableHead className="text-xs md:text-sm text-right">Total Value</TableHead>
                    <TableHead className="text-xs md:text-sm text-right hidden lg:table-cell">Commission</TableHead>
                    <TableHead className="text-xs md:text-sm text-right hidden xl:table-cell">Fee</TableHead>
                    <TableHead className="text-xs md:text-sm hidden xl:table-cell">Venue</TableHead>
                    <TableHead className="text-xs md:text-sm hidden lg:table-cell">Order ID</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {executions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={11} className="p-0">
                        <div className="flex items-center justify-center min-h-[400px] w-full">
                          <div className="text-center text-muted-foreground">
                            No executions found.
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    executions.map((execution) => (
                      <TableRow key={execution.id}>
                        <TableCell className="font-medium text-xs md:text-sm whitespace-nowrap">
                          <div className="flex flex-col gap-0.5">
                            <span>{format(new Date(execution.timestamp), "MMM dd, yyyy")}</span>
                            <span className="text-[10px] text-muted-foreground">
                              {format(new Date(execution.timestamp), "HH:mm:ss")}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs md:text-sm hidden md:table-cell">
                          {execution.account?.name || "-"}
                        </TableCell>
                        <TableCell className="font-medium text-xs md:text-sm">
                          <div className="flex flex-col gap-0.5">
                            <span className="font-semibold">{execution.security?.symbol || execution.symbol}</span>
                            {execution.security?.name && (
                              <span className="text-[10px] text-muted-foreground hidden lg:block">
                                {execution.security.name}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <span className={`rounded-[12px] px-1.5 md:px-2 py-0.5 md:py-1 text-[10px] md:text-xs ${
                              execution.side.toLowerCase() === "buy" 
                                ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" 
                                : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                            }`}>
                              {execution.side}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-medium text-xs md:text-sm">
                          {execution.quantity}
                        </TableCell>
                        <TableCell className="text-right font-medium text-xs md:text-sm">
                          {formatMoney(execution.price)}
                        </TableCell>
                        <TableCell className={`text-right font-medium text-xs md:text-sm ${
                          execution.side.toLowerCase() === "buy" 
                            ? "text-green-600 dark:text-green-400" 
                            : "text-red-600 dark:text-red-400"
                        }`}>
                          <div className="flex flex-col items-end gap-0.5">
                            <span>{execution.side.toLowerCase() === "buy" ? "" : "-"}{formatMoney(execution.totalCost)}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-medium text-xs md:text-sm hidden lg:table-cell">
                          {formatMoney(execution.commission)}
                        </TableCell>
                        <TableCell className="text-right font-medium text-xs md:text-sm hidden xl:table-cell">
                          {formatMoney(execution.executionFee)}
                        </TableCell>
                        <TableCell className="text-xs md:text-sm hidden xl:table-cell">
                          {execution.venue || "-"}
                        </TableCell>
                        <TableCell className="text-xs md:text-sm font-mono hidden lg:table-cell">
                          {execution.orderId}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

