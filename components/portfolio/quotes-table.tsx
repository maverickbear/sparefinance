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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface Quote {
  symbol: string;
  symbolId: number;
  tier: string;
  bidPrice: number;
  bidSize: number;
  askPrice: number;
  askSize: number;
  lastTradePriceTrHrs: number;
  lastTradePrice: number;
  lastTradeSize: number;
  lastTradeTick: string;
  lastTradeTime: string;
  volume: number;
  openPrice: number;
  highPrice: number;
  lowPrice: number;
  delay: number;
  isHalted: boolean;
  high52w: number;
  low52w: number;
  VWAP: number;
}

export function QuotesTable() {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadQuotes();
  }, []);

  async function loadQuotes() {
    try {
      setLoading(true);
      
      // First, get user's securities
      const securitiesResponse = await fetch(
        "/api/questrade/market-data/securities"
      );
      if (!securitiesResponse.ok) {
        throw new Error("Failed to fetch securities");
      }
      
      const securitiesData = await securitiesResponse.json();
      const securities = securitiesData.securities || [];
      
      if (securities.length === 0) {
        setQuotes([]);
        return;
      }

      // Get symbolIds (assuming symbolId is stored in the security)
      const symbolIds = securities
        .map((s: any) => {
          // Try to get symbolId from different possible fields
          return s.symbolId || s.questradeSymbolId || null;
        })
        .filter((id: any) => id !== null);

      if (symbolIds.length === 0) {
        setQuotes([]);
        return;
      }

      // Fetch quotes from Questrade
      const quotesResponse = await fetch(
        `/api/questrade/market-data/quotes?symbolIds=${symbolIds.join(",")}`
      );
      
      if (quotesResponse.ok) {
        const quotesData = await quotesResponse.json();
        setQuotes(quotesData.quotes || []);
      }
    } catch (error) {
      console.error("Error loading quotes:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function handleRefresh() {
    setRefreshing(true);
    await loadQuotes();
  }

  const getPriceChange = (quote: Quote) => {
    if (!quote.openPrice || quote.openPrice === 0) return null;
    const change = quote.lastTradePrice - quote.openPrice;
    const changePercent = (change / quote.openPrice) * 100;
    return { change, changePercent };
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Market Quotes</CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={loading || refreshing}
          >
            {refreshing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Refreshing...
              </>
            ) : (
              "Refresh"
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : quotes.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center text-muted-foreground">
              No quotes available.
              <br />
              <span className="text-xs">
                Connect your Questrade account and sync positions to see quotes.
              </span>
            </div>
          </div>
        ) : (
          <div className="rounded-[12px] border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs md:text-sm">Symbol</TableHead>
                  <TableHead className="text-xs md:text-sm text-right">
                    Last Price
                  </TableHead>
                  <TableHead className="text-xs md:text-sm text-right hidden lg:table-cell">
                    Change
                  </TableHead>
                  <TableHead className="text-xs md:text-sm text-right hidden lg:table-cell">
                    Change %
                  </TableHead>
                  <TableHead className="text-xs md:text-sm text-right hidden md:table-cell">
                    Bid
                  </TableHead>
                  <TableHead className="text-xs md:text-sm text-right hidden md:table-cell">
                    Ask
                  </TableHead>
                  <TableHead className="text-xs md:text-sm text-right hidden xl:table-cell">
                    Volume
                  </TableHead>
                  <TableHead className="text-xs md:text-sm text-right hidden xl:table-cell">
                    High
                  </TableHead>
                  <TableHead className="text-xs md:text-sm text-right hidden xl:table-cell">
                    Low
                  </TableHead>
                  <TableHead className="text-xs md:text-sm text-right hidden lg:table-cell">
                    VWAP
                  </TableHead>
                  <TableHead className="text-xs md:text-sm hidden xl:table-cell">
                    Status
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {quotes.map((quote) => {
                  const priceChange = getPriceChange(quote);
                  return (
                    <TableRow key={quote.symbolId}>
                      <TableCell className="font-medium text-xs md:text-sm">
                        {quote.symbol}
                      </TableCell>
                      <TableCell className="text-right font-semibold text-xs md:text-sm">
                        {formatMoney(quote.lastTradePrice)}
                      </TableCell>
                      <TableCell
                        className={`text-right font-medium text-xs md:text-sm hidden lg:table-cell ${
                          priceChange && priceChange.change >= 0
                            ? "text-green-600 dark:text-green-400"
                            : "text-red-600 dark:text-red-400"
                        }`}
                      >
                        {priceChange
                          ? `${priceChange.change >= 0 ? "+" : ""}${formatMoney(priceChange.change)}`
                          : "-"}
                      </TableCell>
                      <TableCell
                        className={`text-right font-medium text-xs md:text-sm hidden lg:table-cell ${
                          priceChange && priceChange.changePercent >= 0
                            ? "text-green-600 dark:text-green-400"
                            : "text-red-600 dark:text-red-400"
                        }`}
                      >
                        {priceChange
                          ? `${priceChange.changePercent >= 0 ? "+" : ""}${priceChange.changePercent.toFixed(2)}%`
                          : "-"}
                      </TableCell>
                      <TableCell className="text-right text-xs md:text-sm hidden md:table-cell">
                        {formatMoney(quote.bidPrice)}
                        {quote.bidSize > 0 && (
                          <span className="text-[10px] text-muted-foreground ml-1">
                            ({quote.bidSize})
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right text-xs md:text-sm hidden md:table-cell">
                        {formatMoney(quote.askPrice)}
                        {quote.askSize > 0 && (
                          <span className="text-[10px] text-muted-foreground ml-1">
                            ({quote.askSize})
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right text-xs md:text-sm hidden xl:table-cell">
                        {quote.volume.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right text-xs md:text-sm hidden xl:table-cell">
                        {formatMoney(quote.highPrice)}
                      </TableCell>
                      <TableCell className="text-right text-xs md:text-sm hidden xl:table-cell">
                        {formatMoney(quote.lowPrice)}
                      </TableCell>
                      <TableCell className="text-right text-xs md:text-sm hidden lg:table-cell">
                        {quote.VWAP ? formatMoney(quote.VWAP) : "-"}
                      </TableCell>
                      <TableCell className="hidden xl:table-cell">
                        {quote.isHalted ? (
                          <Badge variant="destructive" className="text-[10px]">
                            Halted
                          </Badge>
                        ) : quote.delay > 0 ? (
                          <Badge variant="outline" className="text-[10px]">
                            {quote.delay}s delay
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="text-[10px] bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400"
                          >
                            Live
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

