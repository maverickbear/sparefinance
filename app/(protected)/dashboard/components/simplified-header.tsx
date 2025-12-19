"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import dynamic from "next/dynamic";
import { cn } from "@/lib/utils";

// Lazy load heavy form components
const TransactionForm = dynamic(
  () => import("@/components/forms/transaction-form").then(m => ({ default: m.TransactionForm })),
  { ssr: false }
);

interface SimplifiedHeaderProps {
  onAddTransaction?: () => void;
  onConnectAccount?: () => void;
  onSettings?: () => void;
}

export function SimplifiedHeader({ onAddTransaction, onConnectAccount, onSettings }: SimplifiedHeaderProps) {
  const router = useRouter();
  const [isTransactionFormOpen, setIsTransactionFormOpen] = useState(false);

  const handleAddTransaction = () => {
    if (onAddTransaction) {
      onAddTransaction();
    } else {
      setIsTransactionFormOpen(true);
    }
  };

  const handleConnectAccount = () => {
    if (onConnectAccount) {
      onConnectAccount();
    } else {
      router.push("/accounts");
    }
  };

  const handleSettings = () => {
    if (onSettings) {
      onSettings();
    } else {
      router.push("/settings");
    }
  };

  return (
    <>
      <header className="flex items-start justify-between gap-4 py-2 pb-4.5 border-b border-border mb-4.5">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-lg font-semibold tracking-[0.02em] m-0 text-foreground">
            Dashboard
          </h1>
          <p className="m-0 text-muted-foreground text-[13px]">
            Simple snapshot organized by groups. Month-to-date.
          </p>
        </div>
      </header>

      {/* Action Buttons - Moved from header */}
      <div className="flex gap-2 flex-wrap justify-start mb-6">
        <button
          onClick={handleAddTransaction}
          className={cn(
            "border border-border bg-transparent text-foreground",
            "py-2 px-2.5 rounded-[10px] text-[13px]",
            "hover:bg-muted transition-colors cursor-pointer"
          )}
        >
          Add transaction
        </button>
        <button
          onClick={handleConnectAccount}
          className={cn(
            "border border-border bg-transparent text-foreground",
            "py-2 px-2.5 rounded-[10px] text-[13px]",
            "hover:bg-muted transition-colors cursor-pointer"
          )}
        >
          Connect account
        </button>
        <button
          onClick={handleSettings}
          className={cn(
            "border border-border bg-transparent text-foreground",
            "py-2 px-2.5 rounded-[10px] text-[13px]",
            "hover:bg-muted transition-colors cursor-pointer"
          )}
        >
          Settings
        </button>
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

