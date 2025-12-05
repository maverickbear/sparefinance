"use client";

import { usePagePerformance } from "@/hooks/use-page-performance";
import { useEffect } from "react";
import { CategoriesModule } from "@/src/presentation/components/features/categories/categories-module";

export default function CategoriesPage() {
  const perf = usePagePerformance("Settings - Categories");

  useEffect(() => {
    const timer = setTimeout(() => {
      perf.markComplete();
    }, 100);
    return () => clearTimeout(timer);
  }, [perf]);

  return <CategoriesModule />;
}

