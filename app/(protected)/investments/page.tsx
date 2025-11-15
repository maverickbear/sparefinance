"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { FeatureGuard } from "@/components/common/feature-guard";
import { PortfolioSummaryCards } from "@/components/portfolio/portfolio-summary-cards";
import { Loader2 } from "lucide-react";
import type { Holding as SupabaseHolding } from "@/lib/api/investments";
import { convertSupabaseHoldingToHolding, type Holding, type Account, type HistoricalDataPoint } from "@/lib/api/portfolio";
import { IntegrationDropdown } from "@/components/banking/integration-dropdown";
import { SimpleTabs, SimpleTabsList, SimpleTabsTrigger, SimpleTabsContent } from "@/components/ui/simple-tabs";
import { Button } from "@/components/ui/button";
import { Plus, Upload, RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { useWriteGuard } from "@/hooks/use-write-guard";
import { useToast } from "@/components/toast-provider";
import {
  calculateAssetTypeAllocation,
  calculateSectorAllocation,
  calculateAccountAllocation,
} from "@/lib/utils/portfolio-utils";

// Lazy load heavy components
const AssetAllocationChart = dynamic(() => import("@/components/portfolio/asset-allocation-chart").then(m => ({ default: m.AssetAllocationChart })), { ssr: false });
const PortfolioPerformanceChart = dynamic(() => import("@/components/portfolio/portfolio-performance-chart").then(m => ({ default: m.PortfolioPerformanceChart })), { ssr: false });
const HoldingsTable = dynamic(() => import("@/components/portfolio/holdings-table").then(m => ({ default: m.HoldingsTable })), { ssr: false });
const AccountBreakdown = dynamic(() => import("@/components/portfolio/account-breakdown").then(m => ({ default: m.AccountBreakdown })), { ssr: false });
const SectorBreakdown = dynamic(() => import("@/components/portfolio/sector-breakdown").then(m => ({ default: m.SectorBreakdown })), { ssr: false });
const OrdersTabContent = dynamic(() => import("@/components/portfolio/orders-tab-content").then(m => ({ default: m.OrdersTabContent })), { ssr: false });
const ExecutionsTabContent = dynamic(() => import("@/components/portfolio/executions-tab-content").then(m => ({ default: m.ExecutionsTabContent })), { ssr: false });
const MarketDataTabContent = dynamic(() => import("@/components/portfolio/market-data-tab-content").then(m => ({ default: m.MarketDataTabContent })), { ssr: false });
const InvestmentTransactionsTable = dynamic(() => import("@/components/portfolio/investment-transactions-table").then(m => ({ default: m.InvestmentTransactionsTable })), { ssr: false });
const InvestmentTransactionForm = dynamic(() => import("@/components/forms/investment-transaction-form").then(m => ({ default: m.InvestmentTransactionForm })), { ssr: false });
const InvestmentCsvImportDialog = dynamic(() => import("@/components/forms/investment-csv-import-dialog").then(m => ({ default: m.InvestmentCsvImportDialog })), { ssr: false });

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

export default function InvestmentsPage() {
  const { checkWriteAccess } = useWriteGuard();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [portfolioSummary, setPortfolioSummary] = useState<PortfolioSummary | null>(null);
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [historicalData, setHistoricalData] = useState<HistoricalDataPoint[]>([]);
  const [showTransactionForm, setShowTransactionForm] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [isUpdatingPrices, setIsUpdatingPrices] = useState(false);
  
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
          ? await Promise.all(holdingsData.map(convertSupabaseHoldingToHolding))
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
    <FeatureGuard feature="hasInvestments" featureName="Investments" requiredPlan="premium">
      <div className="space-y-4 md:space-y-6">
      <PageHeader
        title="Portfolio Management"
        description="Overview of your investment portfolio"
      >
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
            onClick={async () => {
              if (!checkWriteAccess()) return;
              setIsUpdatingPrices(true);
              try {
                const response = await fetch("/api/investments/prices/update", {
                  method: "POST",
                });
                if (response.ok) {
                  const result = await response.json();
                  loadPortfolioData();
                  toast({
                    title: "Prices updated",
                    description: `Updated ${result.updated || 0} security prices${result.errors && result.errors.length > 0 ? `. ${result.errors.length} errors occurred.` : "."}`,
                    variant: result.errors && result.errors.length > 0 ? "default" : "success",
                  });
                } else {
                  const error = await response.json();
                  console.error("Error updating prices:", error);
                  toast({
                    title: "Error",
                    description: error.error || "Failed to update prices",
                    variant: "destructive",
                  });
                }
              } catch (error) {
                console.error("Error updating prices:", error);
              } finally {
                setIsUpdatingPrices(false);
              }
            }}
            variant="outline"
            disabled={isUpdatingPrices}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isUpdatingPrices ? "animate-spin" : ""}`} />
            Update Prices
          </Button>
          <Button
            onClick={() => {
              if (!checkWriteAccess()) return;
              setShowImportDialog(true);
            }}
            variant="outline"
          >
            <Upload className="h-4 w-4 mr-2" />
            Import CSV
          </Button>
          <Button
            onClick={() => {
              if (!checkWriteAccess()) return;
              setShowTransactionForm(true);
            }}
            variant="default"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Transaction
          </Button>
        </div>
      </PageHeader>

        <SimpleTabs defaultValue="overview" className="w-full">
          <SimpleTabsList>
            <SimpleTabsTrigger value="overview">Overview</SimpleTabsTrigger>
            <SimpleTabsTrigger value="transactions">Transactions</SimpleTabsTrigger>
            <SimpleTabsTrigger value="orders">Orders</SimpleTabsTrigger>
            <SimpleTabsTrigger value="executions">Executions</SimpleTabsTrigger>
            <SimpleTabsTrigger value="market-data">Market Data</SimpleTabsTrigger>
          </SimpleTabsList>

          <SimpleTabsContent value="overview" className="mt-4">
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
              </div>
            )}
          </SimpleTabsContent>

          <SimpleTabsContent value="transactions">
            <InvestmentTransactionsTable
              onTransactionChange={() => {
                loadPortfolioData();
              }}
            />
          </SimpleTabsContent>

          <SimpleTabsContent value="orders" className="mt-4">
            <OrdersTabContent />
          </SimpleTabsContent>

          <SimpleTabsContent value="executions" className="mt-4">
            <ExecutionsTabContent />
          </SimpleTabsContent>

          <SimpleTabsContent value="market-data" className="mt-4">
            <MarketDataTabContent />
          </SimpleTabsContent>
        </SimpleTabs>
      </div>
      
      <InvestmentTransactionForm
        open={showTransactionForm}
        onOpenChange={setShowTransactionForm}
        onSuccess={() => {
          loadPortfolioData();
        }}
      />
      <InvestmentCsvImportDialog
        open={showImportDialog}
        onOpenChange={setShowImportDialog}
        onSuccess={() => {
          loadPortfolioData();
        }}
      />
    </FeatureGuard>
  );
}
