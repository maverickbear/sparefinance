"use client";

import { useEffect, useState } from "react";
import { useSubscription } from "@/hooks/use-subscription";
import { PortfolioPerformanceChart } from "@/components/portfolio/portfolio-performance-chart";
import type { HistoricalDataPoint } from "@/lib/api/portfolio";
import { CardSkeleton } from "@/components/ui/card-skeleton";

interface PortfolioPerformanceWidgetProps {
  savings: number; // Fallback value if no portfolio data
}

interface PortfolioSummary {
  totalValue: number;
}

export function PortfolioPerformanceWidget({
  savings,
}: PortfolioPerformanceWidgetProps) {
  const { limits, checking: limitsLoading } = useSubscription();
  const [portfolioSummary, setPortfolioSummary] = useState<PortfolioSummary | null>(null);
  const [historicalData, setHistoricalData] = useState<HistoricalDataPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Check if user has access to investments feature
  const hasInvestmentsAccess = limits.hasInvestments === true;

  useEffect(() => {
    // Skip API calls if user doesn't have access to investments
    if (!hasInvestmentsAccess) {
      setIsLoading(false);
      return;
    }

    async function loadPortfolioData() {
      try {
        setIsLoading(true);
        
        // Use the same consolidated endpoint as the Investments page
        // This ensures we get the same data structure and avoids inconsistencies
        const allDataRes = await fetch("/api/portfolio/all?days=365", { cache: 'no-store' }).catch((err) => {
          console.error("[Portfolio Performance Widget] Error fetching portfolio data:", err);
          return null;
        });

        if (!allDataRes || !allDataRes.ok) {
          console.error("[Portfolio Performance Widget] Portfolio data request failed");
          setIsLoading(false);
          return;
        }

        // Get all data from single response (same as Investments page)
        const allData = await allDataRes.json();
        const summary = allData.summary || null;
        const historical = allData.historical || null;

        // Debug logging
        console.log("[Portfolio Performance Widget] Summary:", summary);
        console.log("[Portfolio Performance Widget] Historical data points:", historical?.length || 0);

        if (summary) {
          setPortfolioSummary(summary);
        }

        if (historical && Array.isArray(historical)) {
          // Ensure data is sorted by date (ascending)
          const sortedHistorical = [...historical].sort((a, b) => {
            const dateA = new Date(a.date).getTime();
            const dateB = new Date(b.date).getTime();
            return dateA - dateB;
          });
          setHistoricalData(sortedHistorical);
          console.log("[Portfolio Performance Widget] Historical data sorted, first date:", sortedHistorical[0]?.date, "last date:", sortedHistorical[sortedHistorical.length - 1]?.date);
        } else {
          setHistoricalData([]);
        }
      } catch (error) {
        console.error("Error loading portfolio data:", error);
      } finally {
        setIsLoading(false);
      }
    }

    loadPortfolioData();
  }, [hasInvestmentsAccess]);

  // Show loading state while checking limits or loading data
  if (limitsLoading || isLoading) {
    return <CardSkeleton />;
  }

  // If user doesn't have access to investments, show nothing or a message
  if (!hasInvestmentsAccess) {
    return null;
  }

  // Use portfolio data if available, otherwise fallback to savings
  const currentValue = portfolioSummary?.totalValue ?? savings;

  // If no historical data and no portfolio value, don't show the chart
  if (historicalData.length === 0 && currentValue === savings && savings === 0) {
    return null;
  }

  return (
    <PortfolioPerformanceChart
      data={historicalData}
      currentValue={currentValue}
    />
  );
}

