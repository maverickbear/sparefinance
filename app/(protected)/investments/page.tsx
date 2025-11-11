"use client";

import { useState, useEffect } from "react";
import { FeatureGuard } from "@/components/common/feature-guard";
import { PortfolioSummaryCards } from "@/components/portfolio/portfolio-summary-cards";
import { AssetAllocationChart } from "@/components/portfolio/asset-allocation-chart";
import { PortfolioPerformanceChart } from "@/components/portfolio/portfolio-performance-chart";
import { HoldingsTable } from "@/components/portfolio/holdings-table";
import { AccountBreakdown } from "@/components/portfolio/account-breakdown";
import { SectorBreakdown } from "@/components/portfolio/sector-breakdown";
import {
  calculateAssetTypeAllocation,
  calculateSectorAllocation,
  calculateAccountAllocation,
} from "@/lib/utils/portfolio-utils";
import { Loader2 } from "lucide-react";
import type { Holding as SupabaseHolding } from "@/lib/api/investments";
import { convertSupabaseHoldingToHolding } from "@/lib/mock-data/portfolio-mock-data";
import { IntegrationDropdown } from "@/components/banking/integration-dropdown";
import { QuestradeDataTables } from "@/components/portfolio/questrade-data-tables";
import { OrdersTabContent } from "@/components/portfolio/orders-tab-content";
import { ExecutionsTabContent } from "@/components/portfolio/executions-tab-content";
import { MarketDataTabContent } from "@/components/portfolio/market-data-tab-content";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { InvestmentTransactionForm } from "@/components/forms/investment-transaction-form";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

// Types
interface PortfolioSummary {
  totalValue: number;
  dayChange: number;
  dayChangePercent: number;
  totalReturn: number;
  totalReturnPercent: number;
  totalCost: number;
  holdingsCount: number;
}

interface Account {
  id: string;
  name: string;
  type: string;
  value: number;
  allocationPercent: number;
}

interface HistoricalDataPoint {
  date: string;
  value: number;
}

interface Holding {
  id: string;
  symbol: string;
  name: string;
  assetType: string;
  sector: string;
  quantity: number;
  avgPrice: number;
  currentPrice: number;
  marketValue: number;
  bookValue: number;
  unrealizedPnL: number;
  unrealizedPnLPercent: number;
  accountId: string;
  accountName: string;
}

export default function InvestmentsPage() {
  const [loading, setLoading] = useState(true);
  const [portfolioSummary, setPortfolioSummary] = useState<PortfolioSummary | null>(null);
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [historicalData, setHistoricalData] = useState<HistoricalDataPoint[]>([]);
  const [showTransactionForm, setShowTransactionForm] = useState(false);
  
  useEffect(() => {
    loadPortfolioData();
  }, []);

  async function loadPortfolioData() {
    try {
      setLoading(true);
      
      // Fetch all portfolio data in parallel
      const [summaryRes, holdingsRes, accountsRes, historicalRes] = await Promise.all([
        fetch("/api/portfolio/summary").catch(() => null),
        fetch("/api/portfolio/holdings").catch(() => null),
        fetch("/api/portfolio/accounts").catch(() => null),
        fetch("/api/portfolio/historical?days=365").catch(() => null),
      ]);

      // Get data from API responses
      const summary = summaryRes?.ok ? await summaryRes.json() : null;
      const holdingsData: SupabaseHolding[] = holdingsRes?.ok ? await holdingsRes.json() : null;
      const accountsData = accountsRes?.ok ? await accountsRes.json() : null;
      const historical = historicalRes?.ok ? await historicalRes.json() : null;

      // Always show dashboard, use zero values if no data
      const defaultSummary: PortfolioSummary = {
        totalValue: 0,
        dayChange: 0,
        dayChangePercent: 0,
        totalReturn: 0,
        totalReturnPercent: 0,
        totalCost: 0,
        holdingsCount: 0,
      };

      // Use real data if available, otherwise use defaults
      setPortfolioSummary(summary || defaultSummary);
      setHoldings(
        holdingsData && Array.isArray(holdingsData) && holdingsData.length > 0
          ? holdingsData.map(convertSupabaseHoldingToHolding)
          : []
      );
      setAccounts(accountsData && Array.isArray(accountsData) ? accountsData : []);
            setHistoricalData(historical && Array.isArray(historical) ? historical : []);
    } catch (error) {
      console.error("Error loading portfolio data:", error);
      // On error, use zero values to show empty dashboard
      const defaultSummary: PortfolioSummary = {
        totalValue: 0,
        dayChange: 0,
        dayChangePercent: 0,
        totalReturn: 0,
        totalReturnPercent: 0,
        totalCost: 0,
        holdingsCount: 0,
      };
      setPortfolioSummary(defaultSummary);
      setHoldings([]);
      setAccounts([]);
      setHistoricalData([]);
    } finally {
      setLoading(false);
    }
  }

  // Calculate allocations (will be empty arrays if no holdings)
  const assetTypeAllocation = holdings.length > 0 
    ? calculateAssetTypeAllocation(holdings)
    : [];
  
  const sectorAllocation = holdings.length > 0
    ? calculateSectorAllocation(holdings)
    : [];
  
  const accountsWithAllocation = holdings.length > 0 && accounts.length > 0
    ? calculateAccountAllocation(holdings, accounts)
    : [];

  // Always show dashboard, even with zero values
  const displaySummary = portfolioSummary || {
    totalValue: 0,
    dayChange: 0,
    dayChangePercent: 0,
    totalReturn: 0,
    totalReturnPercent: 0,
    totalCost: 0,
    holdingsCount: 0,
  };

  return (
    <FeatureGuard feature="hasInvestments" featureName="Investments">
      <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="space-y-2">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Portfolio Management</h1>
            <p className="text-sm md:text-base text-muted-foreground">
              Overview of your investment portfolio
            </p>
          </div>
        </div>
          <div className="flex items-center gap-2">
            <IntegrationDropdown
              onSync={() => {
                loadPortfolioData();
              }}
              onDisconnect={() => {
                loadPortfolioData();
              }}
              onSuccess={loadPortfolioData}
            />
            <Button
              onClick={() => setShowTransactionForm(true)}
              variant="default"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Transaction
            </Button>
                    </div>
        </div>

        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-4 md:w-fit">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="orders">Orders</TabsTrigger>
            <TabsTrigger value="executions">Executions</TabsTrigger>
            <TabsTrigger value="market-data">Market Data</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-4">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="space-y-4 md:space-y-6">
                {/* Summary Cards */}
                <PortfolioSummaryCards summary={displaySummary} />

                {/* Portfolio Performance Chart - Full Width */}
                <PortfolioPerformanceChart
                  data={historicalData}
                  currentValue={displaySummary.totalValue}
                />

                {/* Asset Allocation and Sector Allocation - Side by Side */}
                <div className="grid gap-6 sm:gap-8 grid-cols-1 md:grid-cols-2">
                  <AssetAllocationChart data={assetTypeAllocation} />
                  <SectorBreakdown data={sectorAllocation} />
                </div>

                {/* Account Breakdown */}
                <AccountBreakdown accounts={accountsWithAllocation} />

                {/* Holdings Table */}
                <HoldingsTable holdings={holdings} />

                {/* Questrade Data Tables */}
                <QuestradeDataTables />
              </div>
            )}
          </TabsContent>

          <TabsContent value="orders" className="mt-4">
            <OrdersTabContent />
          </TabsContent>

          <TabsContent value="executions" className="mt-4">
            <ExecutionsTabContent />
          </TabsContent>

          <TabsContent value="market-data" className="mt-4">
            <MarketDataTabContent />
          </TabsContent>
        </Tabs>
      </div>
      
      <InvestmentTransactionForm
        open={showTransactionForm}
        onOpenChange={setShowTransactionForm}
        onSuccess={() => {
          loadPortfolioData();
        }}
      />
    </FeatureGuard>
  );
}
