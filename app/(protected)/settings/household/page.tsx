"use client";

import { usePagePerformance } from "@/hooks/use-page-performance";
import { useEffect } from "react";
import { HouseholdModule } from "@/src/presentation/components/features/household/household-module";

export default function HouseholdPage() {
  const perf = usePagePerformance("Settings - Household");

  useEffect(() => {
    const timer = setTimeout(() => {
      perf.markComplete();
    }, 100);
    return () => clearTimeout(timer);
  }, [perf]);

  return <HouseholdModule />;
}

