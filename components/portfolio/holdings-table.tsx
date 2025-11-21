"use client";

import { useState, useMemo, useCallback, memo } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatMoney } from "@/components/common/money";
import { Holding } from "@/lib/api/portfolio";
import {
  getUniqueAssetTypes,
  getUniqueSectors,
  filterHoldingsByAssetType,
  filterHoldingsBySector,
} from "@/lib/utils/portfolio-utils";
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { HoldingsMobileCard } from "./holdings-mobile-card";

interface HoldingsTableProps {
  holdings: Holding[];
}

type SortField = "symbol" | "assetType" | "sector" | "marketValue" | "unrealizedPnL" | "unrealizedPnLPercent";
type SortDirection = "asc" | "desc";

export const HoldingsTable = memo(function HoldingsTable({ holdings }: HoldingsTableProps) {
  const [assetTypeFilter, setAssetTypeFilter] = useState<string | null>(null);
  const [sectorFilter, setSectorFilter] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>("marketValue");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const uniqueAssetTypes = useMemo(() => getUniqueAssetTypes(holdings), [holdings]);
  const uniqueSectors = useMemo(() => getUniqueSectors(holdings), [holdings]);

  const filteredHoldings = useMemo(() => {
    let filtered = holdings;
    if (assetTypeFilter) {
      filtered = filterHoldingsByAssetType(filtered, assetTypeFilter);
    }
    if (sectorFilter) {
      filtered = filterHoldingsBySector(filtered, sectorFilter);
    }
    return filtered;
  }, [holdings, assetTypeFilter, sectorFilter]);

  const sortedHoldings = useMemo(() => {
    const sorted = [...filteredHoldings];
    sorted.sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortField) {
        case "symbol":
          aValue = a.symbol;
          bValue = b.symbol;
          break;
        case "assetType":
          aValue = a.assetType;
          bValue = b.assetType;
          break;
        case "sector":
          aValue = a.sector;
          bValue = b.sector;
          break;
        case "marketValue":
          aValue = a.marketValue;
          bValue = b.marketValue;
          break;
        case "unrealizedPnL":
          aValue = a.unrealizedPnL;
          bValue = b.unrealizedPnL;
          break;
        case "unrealizedPnLPercent":
          aValue = a.unrealizedPnLPercent;
          bValue = b.unrealizedPnLPercent;
          break;
        default:
          return 0;
      }

      if (typeof aValue === "string" && typeof bValue === "string") {
        return sortDirection === "asc"
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }

      return sortDirection === "asc" ? aValue - bValue : bValue - aValue;
    });
    return sorted;
  }, [filteredHoldings, sortField, sortDirection]);

  const handleSort = useCallback((field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  }, [sortField, sortDirection]);

  const SortButton = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <Button
      variant="ghost"
      size="small"
      className="-ml-3 hover:bg-transparent"
      onClick={() => handleSort(field)}
    >
      {children}
      {sortField === field ? (
        sortDirection === "asc" ? (
          <ArrowUp className="ml-2 h-3 w-3" />
        ) : (
          <ArrowDown className="ml-2 h-3 w-3" />
        )
      ) : (
        <ArrowUpDown className="ml-2 h-3 w-3 opacity-50" />
      )}
    </Button>
  );

  return (
    <Card className="border-0 shadow-none !p-0 bg-transparent">
      <CardHeader className="!p-0 !md:p-0">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <CardTitle>Holdings</CardTitle>
          <div className="flex gap-2">
            <Select
              value={assetTypeFilter || "all"}
              onValueChange={(value) => setAssetTypeFilter(value === "all" ? null : value)}
            >
              <SelectTrigger size="small" className="w-[140px]">
                <SelectValue placeholder="Asset Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {uniqueAssetTypes.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={sectorFilter || "all"}
              onValueChange={(value) => setSectorFilter(value === "all" ? null : value)}
            >
              <SelectTrigger size="small" className="w-[140px]">
                <SelectValue placeholder="Sector" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sectors</SelectItem>
                {uniqueSectors.map((sector) => (
                  <SelectItem key={sector} value={sector}>
                    {sector}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent className="!p-0 !md:p-0">
        {/* Mobile Card View */}
        <div className="lg:hidden space-y-3">
          {sortedHoldings.length === 0 ? (
            <div className="flex items-center justify-center min-h-[400px] w-full">
              <div className="text-center text-muted-foreground">
                No holdings found
              </div>
            </div>
          ) : (
            sortedHoldings.map((holding, index) => (
              <HoldingsMobileCard key={`${holding.id}-${holding.accountId}-${index}`} holding={holding} />
            ))
          )}
        </div>

        {/* Desktop/Tablet Table View */}
        <div className="hidden lg:block rounded-[12px] border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs md:text-sm">
                  <SortButton field="symbol">Symbol</SortButton>
                </TableHead>
                <TableHead className="text-xs md:text-sm hidden sm:table-cell">
                  <SortButton field="assetType">Type</SortButton>
                </TableHead>
                <TableHead className="text-xs md:text-sm hidden md:table-cell">
                  <SortButton field="sector">Sector</SortButton>
                </TableHead>
                <TableHead className="text-right text-xs md:text-sm">Quantity</TableHead>
                <TableHead className="text-right text-xs md:text-sm hidden lg:table-cell">Avg Price</TableHead>
                <TableHead className="text-right text-xs md:text-sm hidden lg:table-cell">Current Price</TableHead>
                <TableHead className="text-right text-xs md:text-sm">
                  <SortButton field="marketValue">Market Value</SortButton>
                </TableHead>
                <TableHead className="text-right text-xs md:text-sm">
                  <SortButton field="unrealizedPnL">P&L</SortButton>
                </TableHead>
                <TableHead className="text-right text-xs md:text-sm">
                  <SortButton field="unrealizedPnLPercent">P&L %</SortButton>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedHoldings.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="p-0">
                    <div className="flex items-center justify-center min-h-[400px] w-full">
                      <div className="text-center text-muted-foreground">
                        No holdings found
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                sortedHoldings.map((holding, index) => (
                  <TableRow key={`${holding.id}-${holding.accountId}-${index}`}>
                    <TableCell className="font-medium text-xs md:text-sm">
                      <div className="flex flex-col gap-0.5">
                        <span className="font-semibold">{holding.symbol}</span>
                        <span className="text-[10px] text-muted-foreground hidden lg:block">{holding.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs md:text-sm hidden sm:table-cell">
                      <div className="flex items-center gap-1">
                        <span className={`rounded-[12px] px-1.5 md:px-2 py-0.5 md:py-1 text-[10px] md:text-xs ${
                          holding.assetType === "Stock" 
                            ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" 
                            : holding.assetType === "ETF"
                            ? "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200"
                            : holding.assetType === "Crypto"
                            ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
                            : "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200"
                        }`}>
                          {holding.assetType}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs md:text-sm hidden md:table-cell">{holding.sector}</TableCell>
                    <TableCell className="text-right font-medium text-xs md:text-sm">
                      {holding.quantity.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right font-medium text-xs md:text-sm hidden lg:table-cell">
                      {formatMoney(holding.avgPrice)}
                    </TableCell>
                    <TableCell className="text-right font-medium text-xs md:text-sm hidden lg:table-cell">
                      {formatMoney(holding.currentPrice)}
                    </TableCell>
                    <TableCell className="text-right font-medium text-xs md:text-sm">
                      {formatMoney(holding.marketValue)}
                    </TableCell>
                    <TableCell
                      className={cn(
                        "text-right font-medium text-xs md:text-sm",
                        holding.unrealizedPnL >= 0
                          ? "text-green-600 dark:text-green-400"
                          : "text-red-600 dark:text-red-400"
                      )}
                    >
                      <div className="flex flex-col items-end gap-0.5">
                        <span>{holding.unrealizedPnL >= 0 ? "+" : ""}{formatMoney(holding.unrealizedPnL)}</span>
                      </div>
                    </TableCell>
                    <TableCell
                      className={cn(
                        "text-right font-medium text-xs md:text-sm",
                        holding.unrealizedPnLPercent >= 0
                          ? "text-green-600 dark:text-green-400"
                          : "text-red-600 dark:text-red-400"
                      )}
                    >
                      <div className="flex flex-col items-end gap-0.5">
                        <span>{holding.unrealizedPnLPercent >= 0 ? "+" : ""}{holding.unrealizedPnLPercent.toFixed(2)}%</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
});

