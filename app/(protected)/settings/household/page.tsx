"use client";

import { usePagePerformance } from "@/hooks/use-page-performance";
import { useEffect } from "react";
import { HouseholdModule } from "@/src/presentation/components/features/household/household-module";
import { PageHeader } from "@/components/common/page-header";

export default function HouseholdPage() {
  const perf = usePagePerformance("Settings - Household");

  useEffect(() => {
    const timer = setTimeout(() => {
      perf.markComplete();
    }, 100);
    return () => clearTimeout(timer);
  }, [perf]);

  return (
    <div>
      <PageHeader
        title="Household"
      />

      <div className="w-full p-4 lg:p-8">
        <HouseholdModule />
      </div>
    </div>
  );
}

