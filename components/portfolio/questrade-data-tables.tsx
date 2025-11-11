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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2 } from "lucide-react";
import { formatMoney } from "@/components/common/money";
import { format } from "date-fns";

interface QuestradeConnection {
  id: string;
  apiServerUrl: string;
  tokenExpiresAt: string;
  lastSyncedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface InvestmentAccount {
  id: string;
  name: string;
  type: string;
  questradeAccountNumber: string;
  cash: number | null;
  marketValue: number | null;
  totalEquity: number | null;
  buyingPower: number | null;
  maintenanceExcess: number | null;
  currency: string | null;
  balanceLastUpdatedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface Security {
  id: string;
  symbol: string;
  name: string;
  class: string;
  sector: string | null;
  createdAt: string;
  updatedAt: string;
}

interface Position {
  id: string;
  accountId: string;
  securityId: string;
  openQuantity: number;
  closedQuantity: number;
  currentMarketValue: number;
  currentPrice: number;
  averageEntryPrice: number;
  closedPnl: number;
  openPnl: number;
  totalCost: number;
  isRealTime: boolean;
  isUnderReorg: boolean;
  lastUpdatedAt: string;
  createdAt: string;
  updatedAt: string;
  security?: Security;
  account?: {
    name: string;
    questradeAccountNumber: string;
  };
}

interface InvestmentTransaction {
  id: string;
  accountId: string;
  securityId: string;
  date: string;
  type: string;
  quantity: number;
  price: number;
  fees: number;
  notes: string | null;
  security?: Security;
  account?: {
    name: string;
    questradeAccountNumber: string;
  };
}

interface QuestradeData {
  connection: QuestradeConnection | null;
  accounts: InvestmentAccount[];
  securities: Security[];
  positions: Position[];
  transactions: InvestmentTransaction[];
}

export function QuestradeDataTables() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<QuestradeData | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      const response = await fetch("/api/questrade/data");
      if (response.ok) {
        const result = await response.json();
        setData(result);
      }
    } catch (error) {
      console.error("Error loading Questrade data:", error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data || !data.connection) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Questrade Data</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center min-h-[400px] w-full">
            <p className="text-sm text-muted-foreground text-center">
              No Questrade connection found.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Questrade Data</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="connection" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="connection">Connection</TabsTrigger>
            <TabsTrigger value="accounts">Accounts</TabsTrigger>
            <TabsTrigger value="positions">Positions</TabsTrigger>
            <TabsTrigger value="securities">Securities</TabsTrigger>
            <TabsTrigger value="transactions">Transactions</TabsTrigger>
          </TabsList>

          <TabsContent value="connection" className="mt-4">
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Field</TableHead>
                    <TableHead>Value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-medium">ID</TableCell>
                    <TableCell className="font-mono text-xs">
                      {data.connection.id}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">API Server URL</TableCell>
                    <TableCell>{data.connection.apiServerUrl}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Token Expires At</TableCell>
                    <TableCell>
                      {format(new Date(data.connection.tokenExpiresAt), "MMM dd, yyyy HH:mm")}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Last Synced At</TableCell>
                    <TableCell>
                      {data.connection.lastSyncedAt
                        ? format(new Date(data.connection.lastSyncedAt), "MMM dd, yyyy HH:mm")
                        : "Never"}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Created At</TableCell>
                    <TableCell>
                      {format(new Date(data.connection.createdAt), "MMM dd, yyyy HH:mm")}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Updated At</TableCell>
                    <TableCell>
                      {format(new Date(data.connection.updatedAt), "MMM dd, yyyy HH:mm")}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="accounts" className="mt-4">
            {data.accounts.length === 0 ? (
              <div className="flex items-center justify-center min-h-[400px] w-full">
                <p className="text-sm text-muted-foreground text-center">
                  No accounts found.
                </p>
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Number</TableHead>
                      <TableHead>Cash</TableHead>
                      <TableHead>Market Value</TableHead>
                      <TableHead>Total Equity</TableHead>
                      <TableHead>Buying Power</TableHead>
                      <TableHead>Currency</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.accounts.map((account) => (
                      <TableRow key={account.id}>
                        <TableCell className="font-medium">{account.name}</TableCell>
                        <TableCell>{account.type}</TableCell>
                        <TableCell className="font-mono text-xs">
                          {account.questradeAccountNumber}
                        </TableCell>
                        <TableCell>
                          {account.cash !== null
                            ? formatMoney(account.cash)
                            : "-"}
                        </TableCell>
                        <TableCell>
                          {account.marketValue !== null
                            ? formatMoney(account.marketValue)
                            : "-"}
                        </TableCell>
                        <TableCell>
                          {account.totalEquity !== null
                            ? formatMoney(account.totalEquity)
                            : "-"}
                        </TableCell>
                        <TableCell>
                          {account.buyingPower !== null
                            ? formatMoney(account.buyingPower)
                            : "-"}
                        </TableCell>
                        <TableCell>{account.currency || "CAD"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>

          <TabsContent value="positions" className="mt-4">
            {data.positions.length === 0 ? (
              <div className="flex items-center justify-center min-h-[400px] w-full">
                <p className="text-sm text-muted-foreground text-center">
                  No positions found.
                </p>
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Account</TableHead>
                      <TableHead>Security</TableHead>
                      <TableHead>Open Quantity</TableHead>
                      <TableHead>Closed Quantity</TableHead>
                      <TableHead>Current Price</TableHead>
                      <TableHead>Avg Entry Price</TableHead>
                      <TableHead>Market Value</TableHead>
                      <TableHead>Open P&L</TableHead>
                      <TableHead>Closed P&L</TableHead>
                      <TableHead>Total Cost</TableHead>
                      <TableHead>Real-Time</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.positions.map((position) => (
                      <TableRow key={position.id}>
                        <TableCell>
                          {position.account?.name || position.accountId}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {position.security?.symbol || position.securityId}
                        </TableCell>
                        <TableCell>{position.openQuantity}</TableCell>
                        <TableCell>{position.closedQuantity}</TableCell>
                        <TableCell>{formatMoney(position.currentPrice)}</TableCell>
                        <TableCell>{formatMoney(position.averageEntryPrice)}</TableCell>
                        <TableCell>{formatMoney(position.currentMarketValue)}</TableCell>
                        <TableCell>
                          <span
                            className={`${
                              position.openPnl >= 0
                                ? "text-green-600 dark:text-green-400"
                                : "text-red-600 dark:text-red-400"
                            }`}
                          >
                            {formatMoney(position.openPnl)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span
                            className={`${
                              position.closedPnl >= 0
                                ? "text-green-600 dark:text-green-400"
                                : "text-red-600 dark:text-red-400"
                            }`}
                          >
                            {formatMoney(position.closedPnl)}
                          </span>
                        </TableCell>
                        <TableCell>{formatMoney(position.totalCost)}</TableCell>
                        <TableCell>
                          {position.isRealTime ? (
                            <span className="text-green-600 dark:text-green-400">Yes</span>
                          ) : (
                            <span className="text-muted-foreground">No</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>

          <TabsContent value="securities" className="mt-4">
            {data.securities.length === 0 ? (
              <div className="flex items-center justify-center min-h-[400px] w-full">
                <p className="text-sm text-muted-foreground text-center">
                  No securities found.
                </p>
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Symbol</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Class</TableHead>
                      <TableHead>Sector</TableHead>
                      <TableHead>Created At</TableHead>
                      <TableHead>Updated At</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.securities.map((security) => (
                      <TableRow key={security.id}>
                        <TableCell className="font-medium font-mono">
                          {security.symbol}
                        </TableCell>
                        <TableCell>{security.name}</TableCell>
                        <TableCell>{security.class}</TableCell>
                        <TableCell>{security.sector || "-"}</TableCell>
                        <TableCell>
                          {format(new Date(security.createdAt), "MMM dd, yyyy HH:mm")}
                        </TableCell>
                        <TableCell>
                          {format(new Date(security.updatedAt), "MMM dd, yyyy HH:mm")}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>

          <TabsContent value="transactions" className="mt-4">
            {data.transactions.length === 0 ? (
              <div className="flex items-center justify-center min-h-[400px] w-full">
                <p className="text-sm text-muted-foreground text-center">
                  No transactions found.
                </p>
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Account</TableHead>
                      <TableHead>Security</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Quantity</TableHead>
                      <TableHead>Price</TableHead>
                      <TableHead>Fees</TableHead>
                      <TableHead>Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.transactions.map((transaction) => (
                      <TableRow key={transaction.id}>
                        <TableCell>
                          {format(new Date(transaction.date), "MMM dd, yyyy")}
                        </TableCell>
                        <TableCell>
                          {transaction.account?.name || transaction.accountId}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {transaction.security?.symbol || transaction.securityId}
                        </TableCell>
                        <TableCell>
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                              transaction.type === "buy"
                                ? "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400"
                                : "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400"
                            }`}
                          >
                            {transaction.type.toUpperCase()}
                          </span>
                        </TableCell>
                        <TableCell>{transaction.quantity}</TableCell>
                        <TableCell>{formatMoney(transaction.price)}</TableCell>
                        <TableCell>{formatMoney(transaction.fees)}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {transaction.notes || "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

