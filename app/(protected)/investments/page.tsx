"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { usePagePerformance } from "@/hooks/use-page-performance";
import { PortfolioSummaryCards } from "@/components/portfolio/portfolio-summary-cards";
import { Loader2 } from "lucide-react";
import type { Holding as SupabaseHolding } from "@/lib/api/investments";
import { convertSupabaseHoldingToHolding, type Holding, type Account, type HistoricalDataPoint } from "@/lib/api/portfolio";
import { IntegrationDropdown } from "@/components/banking/integration-dropdown";
import { SimpleTabs, SimpleTabsList, SimpleTabsTrigger, SimpleTabsContent } from "@/components/ui/simple-tabs";
import { FixedTabsWrapper } from "@/components/common/fixed-tabs-wrapper";
import { Button } from "@/components/ui/button";
import { Plus, Upload } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useWriteGuard } from "@/hooks/use-write-guard";
import { useToast } from "@/components/toast-provider";
import { FeatureGuard } from "@/components/common/feature-guard";
import { useSubscription } from "@/hooks/use-subscription";
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
const InvestmentTransactionsTable = dynamic(() => import("@/components/portfolio/investment-transactions-table").then(m => ({ default: m.InvestmentTransactionsTable })), { ssr: false });
const InvestmentTransactionForm = dynamic(() => import("@/components/forms/investment-transaction-form").then(m => ({ default: m.InvestmentTransactionForm })), { ssr: false });
const InvestmentCsvImportDialog = dynamic(() => import("@/components/forms/investment-csv-import-dialog").then(m => ({ default: m.InvestmentCsvImportDialog })), { ssr: false });
const BlockedFeature = dynamic(() => import("@/components/common/blocked-feature").then(m => ({ default: m.BlockedFeature })), { ssr: false });

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
  const router = useRouter();
  const perf = usePagePerformance("Investments");
  const { checkWriteAccess, canWrite } = useWriteGuard();
  const { toast } = useToast();
  const { limits } = useSubscription();
  const [loading, setLoading] = useState(true);
  const [portfolioSummary, setPortfolioSummary] = useState<PortfolioSummary | null>(null);
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [historicalData, setHistoricalData] = useState<HistoricalDataPoint[]>([]);
  const [showTransactionForm, setShowTransactionForm] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showImportUpgradeModal, setShowImportUpgradeModal] = useState(false);
  const [isUpdatingPrices, setIsUpdatingPrices] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  // OPTIMIZED: Share questrade status between IntegrationDropdown instances
  const [questradeStatus, setQuestradeStatus] = useState<{ isConnected: boolean; accountsCount: number } | null>(null);
  
  useEffect(() => {
    loadPortfolioData();
    loadQuestradeStatus();
  }, []);
  
  async function loadQuestradeStatus() {
    try {
      const response = await fetch("/api/questrade/accounts");
      if (response.status === 404) {
        setQuestradeStatus({ isConnected: false, accountsCount: 0 });
        return;
      }
      // Handle 403 (plan restriction) gracefully - just set status to not connected
      if (response.status === 403) {
        setQuestradeStatus({ isConnected: false, accountsCount: 0 });
        return;
      }
      if (!response.ok) {
        throw new Error(`Failed to fetch Questrade accounts: ${response.status}`);
      }
      
      // Check if response has content before parsing JSON
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        setQuestradeStatus({ isConnected: false, accountsCount: 0 });
        return;
      }
      
      // Get text first to check if it's empty
      const text = await response.text();
      if (!text || text.trim().length === 0) {
        setQuestradeStatus({ isConnected: false, accountsCount: 0 });
        return;
      }
      
      // Parse JSON only if we have valid content
      let data;
      try {
        data = JSON.parse(text);
      } catch (parseError) {
        console.error("Error parsing Questrade accounts response:", parseError);
        setQuestradeStatus({ isConnected: false, accountsCount: 0 });
        return;
      }
      
      if (data.accounts) {
        const connectedAccounts = data.accounts.filter((acc: any) => acc.connected);
        setQuestradeStatus({
          isConnected: connectedAccounts.length > 0,
          accountsCount: connectedAccounts.length,
        });
      } else {
        setQuestradeStatus({ isConnected: false, accountsCount: 0 });
      }
    } catch (error) {
      // Don't log 403 errors (plan restrictions) as errors
      if (error instanceof Error && !error.message.includes("404") && !error.message.includes("403")) {
        console.error("Error loading Questrade connection status:", error);
      }
      setQuestradeStatus({ isConnected: false, accountsCount: 0 });
    }
  }

  async function loadPortfolioData() {
    try {
      setLoading(true);
      
      // OPTIMIZED: Use consolidated endpoint to fetch all portfolio data in one request
      // This reduces from 4 HTTP requests to 1, and shares data between functions
      const allDataRes = await fetch("/api/portfolio/all?days=365", { cache: 'no-store' }).catch((err) => {
        console.error("[Investments Page] Error fetching portfolio data:", err);
        return null;
      });

      // Check for errors
      if (!allDataRes) {
        console.error("[Investments Page] Portfolio data request failed");
        setLoading(false);
        return;
      }

      if (!allDataRes.ok) {
        // Handle 403 (plan restriction) gracefully - show empty state
        if (allDataRes.status === 403) {
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
          setLoading(false);
          return;
        }
        
        // Only log non-plan errors
        const errorText = await allDataRes.text();
        console.error("[Investments Page] Portfolio data response error:", allDataRes.status, errorText);
        setLoading(false);
        return;
      }

      // Get all data from single response
      const allData = await allDataRes.json();
      const summary = allData.summary || null;
      const holdingsData: SupabaseHolding[] = allData.holdings || null;
      const accountsData = allData.accounts || null;
      const historical = allData.historical || null;
      
      // Debug logging
      console.log("[Investments Page] Summary:", summary);
      console.log("[Investments Page] Holdings count:", holdingsData?.length || 0);
      console.log("[Investments Page] Accounts count:", accountsData?.length || 0);
      console.log("[Investments Page] Historical data points:", historical?.length || 0);
      
      // Log if we're getting zero values (development only)
      if (process.env.NODE_ENV === 'development' && summary && summary.totalValue === 0 && summary.holdingsCount === 0) {
        console.warn("[Investments Page] WARNING: Summary shows zero values. This might indicate a problem.");
      }

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
      perf.markDataLoaded();
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
    <FeatureGuard 
      feature="hasInvestments"
      headerTitle="Portfolio Management"
    >
    <SimpleTabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <PageHeader
            title="Portfolio Management"
          >
          <div className="flex items-center gap-2">
            <IntegrationDropdown
              initialStatus={questradeStatus}
              onSync={() => {
                loadPortfolioData();
                loadQuestradeStatus();
              }}
              onDisconnect={() => {
                loadPortfolioData();
                loadQuestradeStatus();
              }}
              onSuccess={() => {
                loadPortfolioData();
                loadQuestradeStatus();
              }}
            />
            {canWrite && (
              <>
                <Button
                  onClick={() => {
                    if (!checkWriteAccess()) return;
                    // Check if user has access to CSV import
                    const hasAccess = limits.hasCsvImport === true || String(limits.hasCsvImport) === "true";
                    if (!hasAccess) {
                      setShowImportUpgradeModal(true);
                      return;
                    }
                    setShowImportDialog(true);
                  }}
                  variant="outline"
                  size="medium"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Import File
                </Button>
                <Button
                  onClick={() => {
                    if (!checkWriteAccess()) return;
                    setShowTransactionForm(true);
                  }}
                  variant="default"
                  size="medium"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Transaction
                </Button>
              </>
            )}
          </div>
        </PageHeader>

        {/* Fixed Tabs - Desktop only */}
        <FixedTabsWrapper>
          <SimpleTabsList>
            <SimpleTabsTrigger value="overview">Overview</SimpleTabsTrigger>
            <SimpleTabsTrigger value="transactions">Transactions</SimpleTabsTrigger>
          </SimpleTabsList>
        </FixedTabsWrapper>

        {/* Mobile/Tablet Tabs - Sticky at top */}
        <div 
          className="lg:hidden sticky top-0 z-40 bg-card dark:bg-transparent border-b"
        >
          <div 
            className="overflow-x-auto scrollbar-hide" 
            style={{ 
              WebkitOverflowScrolling: 'touch',
              scrollSnapType: 'x mandatory',
              touchAction: 'pan-x',
            }}
          >
            <SimpleTabsList className="min-w-max px-4" style={{ scrollSnapAlign: 'start' }}>
              <SimpleTabsTrigger value="overview" className="flex-shrink-0 whitespace-nowrap">
                Overview
              </SimpleTabsTrigger>
              <SimpleTabsTrigger value="transactions" className="flex-shrink-0 whitespace-nowrap">
                Transactions
              </SimpleTabsTrigger>
            </SimpleTabsList>
          </div>
        </div>

        <div className="w-full p-4 lg:p-8">
          <SimpleTabsContent value="overview">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="space-y-4 md:space-y-6">
                {/* Summary Cards */}
                <PortfolioSummaryCards 
                  summary={displaySummary}
                  onAddClick={() => {
                    if (!checkWriteAccess()) return;
                    setShowTransactionForm(true);
                  }}
                  onImportClick={() => {
                    if (!checkWriteAccess()) return;
                    // Check if user has access to CSV import
                    const hasAccess = limits.hasCsvImport === true || String(limits.hasCsvImport) === "true";
                    if (!hasAccess) {
                      setShowImportUpgradeModal(true);
                      return;
                    }
                    setShowImportDialog(true);
                  }}
                  integrationProps={{
                    initialStatus: questradeStatus,
                    onSync: () => {
                      loadPortfolioData();
                      loadQuestradeStatus();
                    },
                    onDisconnect: () => {
                      loadPortfolioData();
                      loadQuestradeStatus();
                    },
                    onSuccess: () => {
                      loadPortfolioData();
                      loadQuestradeStatus();
                    },
                  }}
                  onUpdatePrices={async () => {
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
                  isUpdatingPrices={isUpdatingPrices}
                />

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

      {/* CSV Import Upgrade Modal */}
      <Dialog open={showImportUpgradeModal} onOpenChange={setShowImportUpgradeModal}>
        <DialogContent className="max-w-5xl sm:max-w-5xl md:max-w-6xl lg:max-w-7xl max-h-[90vh] overflow-y-auto p-0 gap-0">
          <DialogHeader className="sr-only">
            <DialogTitle>Upgrade to CSV Import</DialogTitle>
          </DialogHeader>
          <div className="p-4 sm:p-6 md:p-8">
            <BlockedFeature feature="hasCsvImport" featureName="CSV Import" />
          </div>
        </DialogContent>
      </Dialog>
      </SimpleTabs>
    </FeatureGuard>
  );
}
