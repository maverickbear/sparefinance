"use client";

import { useState } from "react";
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
import type { TaxRate } from "@/src/domain/taxes/tax-rates.types";

interface TaxRatesTableProps {
  rates: TaxRate[];
  loading?: boolean;
  onEdit: (rate: TaxRate) => void;
}

export function TaxRatesTable({
  rates: initialRates,
  loading: initialLoading,
  onEdit,
}: TaxRatesTableProps) {
  const rates = initialRates;
  const loading = initialLoading;

  const formatPercentage = (rate: number): string => {
    return `${(rate * 100).toFixed(4)}%`;
  };

  const getCountryBadgeVariant = (country: string) => {
    return country === "US" ? "default" : "secondary";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (rates.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No tax rates found
      </div>
    );
  }

  // Group rates by country
  const usRates = rates.filter((r) => r.countryCode === "US");
  const caRates = rates.filter((r) => r.countryCode === "CA");

  return (
    <div className="space-y-6">
      {/* US States */}
      {usRates.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-4">United States</h3>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>State</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Tax Rate</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {usRates.map((rate) => (
                  <TableRow key={rate.id}>
                    <TableCell className="font-medium">
                      {rate.displayName}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{rate.stateOrProvinceCode}</Badge>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono">{formatPercentage(rate.taxRate)}</span>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {rate.description || "-"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={rate.isActive ? "default" : "secondary"}>
                        {rate.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="medium"
                        onClick={() => onEdit(rate)}
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
      )}

      {/* Canadian Provinces */}
      {caRates.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-4">Canada</h3>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Province/Territory</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Tax Rate</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {caRates.map((rate) => (
                  <TableRow key={rate.id}>
                    <TableCell className="font-medium">
                      {rate.displayName}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{rate.stateOrProvinceCode}</Badge>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono">{formatPercentage(rate.taxRate)}</span>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {rate.description || "-"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={rate.isActive ? "default" : "secondary"}>
                        {rate.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="medium"
                        onClick={() => onEdit(rate)}
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
      )}
    </div>
  );
}

