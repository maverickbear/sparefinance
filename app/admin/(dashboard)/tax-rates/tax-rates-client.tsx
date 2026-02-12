"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { TaxRatesTable } from "@/components/admin/tax-rates-table";
import { TaxRateDialog } from "@/components/admin/tax-rate-dialog";
import { FederalBracketsTable } from "@/components/admin/federal-brackets-table";
import { FederalBracketDialog } from "@/components/admin/federal-bracket-dialog";
import type { TaxRate } from "@/src/domain/taxes/tax-rates.types";
import type { FederalTaxBracket } from "@/src/domain/taxes/federal-brackets.types";
import { Loader2, X } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { SimpleTabs, SimpleTabsContent, SimpleTabsList, SimpleTabsTrigger } from "@/components/ui/simple-tabs";

interface TaxRatesPageClientProps {
  initialRates: TaxRate[];
}

export function TaxRatesPageClient({ initialRates }: TaxRatesPageClientProps) {
  const router = useRouter();
  const [rates, setRates] = useState<TaxRate[]>(initialRates);
  const [federalBrackets, setFederalBrackets] = useState<FederalTaxBracket[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingBrackets, setLoadingBrackets] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isBracketDialogOpen, setIsBracketDialogOpen] = useState(false);
  const [editingRate, setEditingRate] = useState<TaxRate | null>(null);
  const [editingBracket, setEditingBracket] = useState<FederalTaxBracket | null>(null);
  const [selectedCountry, setSelectedCountry] = useState<string>("all");
  const [selectedProvince, setSelectedProvince] = useState<string>("all");

  function handleEditRate(rate: TaxRate) {
    setEditingRate(rate);
    setIsDialogOpen(true);
  }

  function handleEditBracket(bracket: FederalTaxBracket) {
    setEditingBracket(bracket);
    setIsBracketDialogOpen(true);
  }

  useEffect(() => {
    async function loadFederalBrackets() {
      try {
        const response = await fetch("/api/v2/federal-brackets");
        if (!response.ok) throw new Error("Failed to fetch federal brackets");
        const brackets = await response.json();
        setFederalBrackets(brackets);
      } catch (error) {
        console.error("Error loading federal brackets:", error);
      } finally {
        setLoadingBrackets(false);
      }
    }
    loadFederalBrackets();
  }, []);

  async function handleSuccess() {
    setLoading(true);
    try {
      const response = await fetch("/api/v2/tax-rates");
      if (!response.ok) throw new Error("Failed to fetch tax rates");
      const updatedRates = await response.json();
      setRates(updatedRates);
    } catch (error) {
      console.error("Error refreshing tax rates:", error);
    } finally {
      setLoading(false);
    }
  }

  const countries = useMemo(() => {
    const unique = Array.from(new Set(rates.map((r) => r.countryCode)));
    return unique.sort();
  }, [rates]);

  const provinces = useMemo(() => {
    let filtered = rates;
    if (selectedCountry !== "all") {
      filtered = filtered.filter((r) => r.countryCode === selectedCountry);
    }
    const unique = Array.from(new Set(filtered.map((r) => r.stateOrProvinceCode)));
    return unique.sort();
  }, [rates, selectedCountry]);

  const filteredRates = useMemo(() => {
    let filtered = rates;
    if (selectedCountry !== "all") {
      filtered = filtered.filter((r) => r.countryCode === selectedCountry);
    }
    if (selectedProvince !== "all") {
      filtered = filtered.filter((r) => r.stateOrProvinceCode === selectedProvince);
    }
    return filtered;
  }, [rates, selectedCountry, selectedProvince]);

  const filteredFederalBrackets = useMemo(() => {
    if (selectedCountry === "all") {
      const countryGroups = federalBrackets.reduce((acc, bracket) => {
        if (!acc[bracket.countryCode]) acc[bracket.countryCode] = [];
        acc[bracket.countryCode].push(bracket);
        return acc;
      }, {} as Record<string, FederalTaxBracket[]>);
      return Object.values(countryGroups).flatMap((brackets) => {
        const maxYear = Math.max(...brackets.map((b) => b.taxYear));
        return brackets.filter((b) => b.taxYear === maxYear);
      });
    } else {
      const countryBrackets = federalBrackets.filter((b) => b.countryCode === selectedCountry);
      if (countryBrackets.length === 0) return [];
      const maxYear = Math.max(...countryBrackets.map((b) => b.taxYear));
      return countryBrackets.filter((b) => b.taxYear === maxYear);
    }
  }, [federalBrackets, selectedCountry]);

  useEffect(() => {
    if (selectedCountry === "all") {
      setSelectedProvince("all");
    } else {
      const validProvinces = rates.filter((r) => r.countryCode === selectedCountry).map((r) => r.stateOrProvinceCode);
      if (!validProvinces.includes(selectedProvince)) setSelectedProvince("all");
    }
  }, [selectedCountry, rates, selectedProvince]);

  function handleClearFilters() {
    setSelectedCountry("all");
    setSelectedProvince("all");
  }

  const hasActiveFilters = selectedCountry !== "all" || selectedProvince !== "all";

  return (
    <div className="w-full p-4 lg:p-8">
      <div className="space-y-2 mb-6">
        <h2 className="text-2xl font-semibold tracking-tight">Tax Rates Management</h2>
        <p className="text-sm text-muted-foreground">
          View and manage tax rates for US states and Canadian provinces.
        </p>
      </div>

      <div className="mb-6">
        <div className="flex flex-col sm:flex-row gap-4 items-end">
          <div className="flex-1 space-y-2">
            <Label htmlFor="country-filter">Country</Label>
            <Select value={selectedCountry} onValueChange={setSelectedCountry}>
              <SelectTrigger id="country-filter" size="medium">
                <SelectValue placeholder="All countries" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Countries</SelectItem>
                {countries.map((country) => (
                  <SelectItem key={country} value={country}>
                    {country === "US" ? "United States" : "Canada"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1 space-y-2">
            <Label htmlFor="province-filter">
              {selectedCountry === "US" ? "State" : selectedCountry === "CA" ? "Province" : "State/Province"}
            </Label>
            <Select value={selectedProvince} onValueChange={setSelectedProvince} disabled={selectedCountry === "all"}>
              <SelectTrigger id="province-filter" size="medium">
                <SelectValue placeholder="All states/provinces" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  All {selectedCountry === "US" ? "States" : selectedCountry === "CA" ? "Provinces" : "States/Provinces"}
                </SelectItem>
                {provinces.map((province) => {
                  const rate = rates.find((r) => r.stateOrProvinceCode === province && r.countryCode === selectedCountry);
                  return (
                    <SelectItem key={province} value={province}>
                      {rate?.displayName || province}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
          {hasActiveFilters && (
            <Button variant="outline" onClick={handleClearFilters} className="whitespace-nowrap">
              <X className="h-4 w-4 mr-2" />
              Clear Filters
            </Button>
          )}
        </div>
        {hasActiveFilters && (
          <div className="mt-4 text-sm text-muted-foreground">
            {selectedCountry !== "all" && <span>Federal: {filteredFederalBrackets.length} brackets | </span>}
            Provincial: {filteredRates.length} of {rates.length} tax rates
          </div>
        )}
      </div>

      <SimpleTabs defaultValue="federal" className="w-full">
        <div className="w-full border-b">
          <SimpleTabsList className="inline-flex w-auto">
            <SimpleTabsTrigger value="federal">Federal Brackets</SimpleTabsTrigger>
            <SimpleTabsTrigger value="provincial">Provincial Rates</SimpleTabsTrigger>
          </SimpleTabsList>
        </div>
        <SimpleTabsContent value="federal" className="mt-6">
          <div className="space-y-2 mb-4">
            <h2 className="text-xl font-semibold tracking-tight">Federal Tax Brackets</h2>
            <p className="text-sm text-muted-foreground">Progressive tax brackets for federal income tax calculations</p>
          </div>
          {loadingBrackets ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <FederalBracketsTable brackets={filteredFederalBrackets} loading={false} onEdit={handleEditBracket} />
          )}
        </SimpleTabsContent>
        <SimpleTabsContent value="provincial" className="mt-6">
          <div className="space-y-2 mb-4">
            <h2 className="text-xl font-semibold tracking-tight">State/Provincial Tax Rates</h2>
            <p className="text-sm text-muted-foreground">Flat or effective tax rates for state/provincial income tax</p>
          </div>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <TaxRatesTable rates={filteredRates} loading={false} onEdit={handleEditRate} />
          )}
        </SimpleTabsContent>
      </SimpleTabs>

      <TaxRateDialog
        open={isDialogOpen}
        onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) setEditingRate(null);
        }}
        rate={editingRate}
        onSuccess={handleSuccess}
      />

      <FederalBracketDialog
        open={isBracketDialogOpen}
        onOpenChange={(open) => {
          setIsBracketDialogOpen(open);
          if (!open) setEditingBracket(null);
        }}
        bracket={editingBracket}
        onSuccess={async () => {
          const response = await fetch("/api/v2/federal-brackets");
          if (response.ok) {
            const brackets = await response.json();
            setFederalBrackets(brackets);
          }
        }}
      />
    </div>
  );
}
