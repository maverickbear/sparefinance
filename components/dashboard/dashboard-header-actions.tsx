"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Plus, Target, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import dynamic from "next/dynamic";

// Lazy load heavy form components
const TransactionForm = dynamic(
  () => import("@/components/forms/transaction-form").then(m => ({ default: m.TransactionForm })),
  { ssr: false }
);

export function DashboardHeaderActions() {
  const router = useRouter();
  const [isTransactionFormOpen, setIsTransactionFormOpen] = useState(false);

  const handleAddTransaction = () => {
    setIsTransactionFormOpen(true);
  };

  const handleCreateBudget = () => {
    router.push("/planning/budgets");
  };

  return (
    <>
      <div className="flex items-center gap-2 px-0">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="medium">
              Quick Actions
              <ChevronDown className="h-3 w-3 ml-1.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={handleAddTransaction}>
              <Plus className="h-4 w-4 mr-2" />
              Add Transaction
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleCreateBudget}>
              <Target className="h-4 w-4 mr-2" />
              Create Budget
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <TransactionForm
        open={isTransactionFormOpen}
        onOpenChange={setIsTransactionFormOpen}
        onSuccess={() => {
          setIsTransactionFormOpen(false);
          router.refresh();
        }}
      />
    </>
  );
}

