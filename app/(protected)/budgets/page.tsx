"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Target, PiggyBank } from "lucide-react";
import { BudgetsTab } from "./budgets-tab";
import { GoalsTab } from "./goals-tab";

export default function BudgetsAndGoalsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<string>("budgets");

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab && ["budgets", "goals"].includes(tab)) {
      setActiveTab(tab);
    } else {
      // Default to budgets if no tab specified
      setActiveTab("budgets");
    }
  }, [searchParams]);

  function handleTabChange(value: string) {
    setActiveTab(value);
    router.push(`/budgets?tab=${value}`, { scroll: false });
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Budgets & Goals</h1>
        <p className="text-sm md:text-base text-muted-foreground">
          Manage your budgets and track your financial goals
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="inline-flex">
          <TabsTrigger value="budgets">
            <Target className="mr-2 h-4 w-4" />
            Budgets
          </TabsTrigger>
          <TabsTrigger value="goals">
            <PiggyBank className="mr-2 h-4 w-4" />
            Goals
          </TabsTrigger>
        </TabsList>

        <TabsContent value="budgets" className="mt-6">
          <BudgetsTab />
        </TabsContent>

        <TabsContent value="goals" className="mt-6">
          <GoalsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
