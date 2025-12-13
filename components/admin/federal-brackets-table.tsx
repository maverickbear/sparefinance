"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Edit } from "lucide-react";
import type { FederalTaxBracket } from "@/src/domain/taxes/federal-brackets.types";

interface FederalBracketsTableProps {
  brackets: FederalTaxBracket[];
  loading?: boolean;
  onEdit: (bracket: FederalTaxBracket) => void;
}

export function FederalBracketsTable({
  brackets: initialBrackets,
  loading: initialLoading,
  onEdit,
}: FederalBracketsTableProps) {
  const brackets = initialBrackets;
  const loading = initialLoading;

  const formatPercentage = (rate: number): string => {
    return `${(rate * 100).toFixed(2)}%`;
  };

  const formatCurrency = (amount: number | null): string => {
    if (amount === null) return "No limit";
    return new Intl.NumberFormat("en-CA", {
      style: "currency",
      currency: "CAD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (brackets.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No federal brackets found
      </div>
    );
  }

  // Filter to show only the most recent (current) year for each country
  const currentYear = new Date().getFullYear();
  const currentBrackets = brackets.filter((bracket) => {
    // Get the most recent year for this country
    const countryBrackets = brackets.filter((b) => b.countryCode === bracket.countryCode);
    const maxYear = Math.max(...countryBrackets.map((b) => b.taxYear));
    // Only show brackets from the most recent year
    return bracket.taxYear === maxYear;
  });

  // Group brackets by country (only current year now)
  const grouped = currentBrackets.reduce((acc, bracket) => {
    const key = bracket.countryCode;
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(bracket);
    return acc;
  }, {} as Record<string, FederalTaxBracket[]>);

  // Sort groups by country
  const sortedGroups = Object.entries(grouped).sort(([a], [b]) => {
    return a.localeCompare(b);
  });

  return (
    <div className="space-y-6">
      {sortedGroups.map(([countryCode, groupBrackets]) => {
        const countryName = countryCode === "US" ? "United States" : "Canada";
        const taxYear = groupBrackets[0]?.taxYear || new Date().getFullYear();
        
        return (
          <div key={countryCode}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">
                {countryName} Federal Tax Brackets - {taxYear}
              </h3>
              <Badge variant="outline">{countryCode}</Badge>
            </div>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Bracket</TableHead>
                    <TableHead>Income Range</TableHead>
                    <TableHead>Tax Rate</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {groupBrackets.map((bracket) => (
                    <TableRow key={bracket.id}>
                      <TableCell className="font-medium">
                        #{bracket.bracketOrder}
                      </TableCell>
                      <TableCell>
                        <span className="font-mono">
                          {formatCurrency(bracket.minIncome)} - {formatCurrency(bracket.maxIncome)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="font-mono font-semibold">
                          {formatPercentage(bracket.taxRate)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant={bracket.isActive ? "default" : "secondary"}>
                          {bracket.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="medium"
                          onClick={() => onEdit(bracket)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        );
      })}
    </div>
  );
}

