"use client";

import { useState, useEffect } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { Loader2 } from "lucide-react";
import { formatMoney } from "@/components/common/money";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";

interface Candle {
  id: string;
  securityId: string;
  symbolId: number;
  start: string;
  end: string;
  low: number;
  high: number;
  open: number;
  close: number;
  volume: number;
  VWAP: number | null;
  interval: string;
}

interface CandlesChartProps {
  securityId: string;
  symbol: string;
}

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="rounded-lg border bg-background p-3 shadow-sm">
        <div className="font-semibold mb-2">
          {format(new Date(data.start), "MMM dd, yyyy HH:mm")}
        </div>
        <div className="space-y-1 text-sm">
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Open:</span>
            <span className="font-medium">{formatMoney(data.open)}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">High:</span>
            <span className="font-medium text-green-600 dark:text-green-400">
              {formatMoney(data.high)}
            </span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Low:</span>
            <span className="font-medium text-red-600 dark:text-red-400">
              {formatMoney(data.low)}
            </span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Close:</span>
            <span className="font-medium">{formatMoney(data.close)}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Volume:</span>
            <span className="font-medium">
              {data.volume.toLocaleString()}
            </span>
          </div>
          {data.VWAP && (
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">VWAP:</span>
              <span className="font-medium">{formatMoney(data.VWAP)}</span>
            </div>
          )}
        </div>
      </div>
    );
  }
  return null;
};

export function CandlesChart({ securityId, symbol }: CandlesChartProps) {
  const [candles, setCandles] = useState<Candle[]>([]);
  const [loading, setLoading] = useState(true);
  const [interval, setInterval] = useState("OneDay");
  const [selectedSecurityId, setSelectedSecurityId] = useState(securityId);

  useEffect(() => {
    if (selectedSecurityId) {
      loadCandles();
    }
  }, [selectedSecurityId, interval]);

  async function loadCandles() {
    if (!selectedSecurityId) return;

    try {
      setLoading(true);
      const response = await fetch(
        `/api/questrade/market-data/candles?securityId=${selectedSecurityId}&interval=${interval}&limit=100`
      );
      if (response.ok) {
        const data = await response.json();
        // Reverse to show oldest first
        setCandles((data.candles || []).reverse());
      }
    } catch (error) {
      console.error("Error loading candles:", error);
    } finally {
      setLoading(false);
    }
  }

  const chartData = candles.map((candle) => ({
    start: candle.start,
    open: candle.open,
    high: candle.high,
    low: candle.low,
    close: candle.close,
    volume: candle.volume,
    VWAP: candle.VWAP,
  }));

  const latestPrice = candles.length > 0 ? candles[candles.length - 1].close : null;
  const previousPrice =
    candles.length > 1 ? candles[candles.length - 2].close : null;
  const change =
    latestPrice && previousPrice ? latestPrice - previousPrice : null;
  const changePercent =
    latestPrice && previousPrice && previousPrice !== 0
      ? ((change! / previousPrice) * 100)
      : null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg font-semibold">{symbol}</CardTitle>
            {latestPrice && (
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold">
                  {formatMoney(latestPrice)}
                </span>
                {change !== null && changePercent !== null && (
                  <span
                    className={`text-sm font-medium ${
                      change >= 0
                        ? "text-green-600 dark:text-green-400"
                        : "text-red-600 dark:text-red-400"
                    }`}
                  >
                    {change >= 0 ? "+" : ""}
                    {formatMoney(change)} ({changePercent >= 0 ? "+" : ""}
                    {changePercent.toFixed(2)}%)
                  </span>
                )}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Select value={interval} onValueChange={setInterval}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="OneMinute">1 Minute</SelectItem>
                <SelectItem value="FiveMinutes">5 Minutes</SelectItem>
                <SelectItem value="FifteenMinutes">15 Minutes</SelectItem>
                <SelectItem value="OneHour">1 Hour</SelectItem>
                <SelectItem value="OneDay">1 Day</SelectItem>
                <SelectItem value="OneWeek">1 Week</SelectItem>
                <SelectItem value="OneMonth">1 Month</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              onClick={loadCandles}
              disabled={loading}
            >
              Refresh
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : candles.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center text-muted-foreground">
              No candle data available for this security.
              <br />
              <span className="text-xs">
                Data will appear after syncing from Questrade.
              </span>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <ResponsiveContainer width="100%" height={400}>
              <LineChart
                data={chartData}
                margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="hsl(var(--border))"
                  opacity={0.3}
                  vertical={false}
                />
                <XAxis
                  dataKey="start"
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                  axisLine={{ stroke: "hsl(var(--border))" }}
                  tickLine={{ stroke: "hsl(var(--border))" }}
                  tickFormatter={(value) => {
                    try {
                      return format(new Date(value), "MMM dd");
                    } catch {
                      return value;
                    }
                  }}
                />
                <YAxis
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                  axisLine={{ stroke: "hsl(var(--border))" }}
                  tickLine={{ stroke: "hsl(var(--border))" }}
                  width={70}
                  tickFormatter={(value) => {
                    if (value >= 1000) return `$${(value / 1000).toFixed(1)}k`;
                    return `$${value.toFixed(2)}`;
                  }}
                />
                <Tooltip content={<CustomTooltip />} />
                <ReferenceLine
                  y={latestPrice || 0}
                  stroke="hsl(var(--muted-foreground))"
                  strokeDasharray="2 2"
                  opacity={0.5}
                />
                <Line
                  type="monotone"
                  dataKey="close"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
                <Line
                  type="monotone"
                  dataKey="high"
                  stroke="hsl(var(--green-500))"
                  strokeWidth={1}
                  dot={false}
                  strokeDasharray="2 2"
                  opacity={0.5}
                />
                <Line
                  type="monotone"
                  dataKey="low"
                  stroke="hsl(var(--red-500))"
                  strokeWidth={1}
                  dot={false}
                  strokeDasharray="2 2"
                  opacity={0.5}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

