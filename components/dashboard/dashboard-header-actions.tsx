"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Plus, Building2, Target } from "lucide-react";
import { AddAccountSheet } from "@/components/accounts/add-account-sheet";
import dynamic from "next/dynamic";

// Lazy load heavy form components
const TransactionForm = dynamic(
  () => import("@/components/forms/transaction-form").then(m => ({ default: m.TransactionForm })),
  { ssr: false }
);

export function DashboardHeaderActions() {
  const router = useRouter();
  const [isAccountSheetOpen, setIsAccountSheetOpen] = useState(false);
  const [isTransactionFormOpen, setIsTransactionFormOpen] = useState(false);

  const handleConnectAccount = () => {
    setIsAccountSheetOpen(true);
  };

  const handleAddTransaction = () => {
    setIsTransactionFormOpen(true);
  };

  const handleCreateBudget = () => {
    router.push("/planning/budgets");
  };

  return (
    <>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="small"
          onClick={handleConnectAccount}
        >
          <Building2 className="h-3 w-3 mr-1.5" />
          Connect Account
        </Button>
        <Button
          variant="outline"
          size="small"
          onClick={handleAddTransaction}
        >
          <Plus className="h-3 w-3 mr-1.5" />
          Add Transaction
        </Button>
        <Button
          variant="outline"
          size="small"
          onClick={handleCreateBudget}
        >
          <Target className="h-3 w-3 mr-1.5" />
          Create Budget
        </Button>
      </div>

      <AddAccountSheet
        open={isAccountSheetOpen}
        onOpenChange={setIsAccountSheetOpen}
        onSuccess={() => {
          setIsAccountSheetOpen(false);
          router.refresh();
        }}
      />

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

