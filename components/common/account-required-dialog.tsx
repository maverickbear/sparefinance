"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { getAccountsClient } from "@/lib/api/accounts-client";
import { AccountForm } from "@/components/forms/account-form";

interface AccountRequiredDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAccountCreated?: () => void;
}

export function AccountRequiredDialog({
  open,
  onOpenChange,
  onAccountCreated,
}: AccountRequiredDialogProps) {
  const [hasAccount, setHasAccount] = useState<boolean | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [isAccountFormOpen, setIsAccountFormOpen] = useState(false);

  useEffect(() => {
    if (open) {
      checkAccounts();
    }
  }, [open]);

  async function checkAccounts() {
    setIsChecking(true);
    try {
      const accounts = await getAccountsClient();
      setHasAccount(accounts.length > 0);
    } catch (error) {
      console.error("Error checking accounts:", error);
      setHasAccount(false);
    } finally {
      setIsChecking(false);
    }
  }

  function handleCreateAccount() {
    setIsAccountFormOpen(true);
  }

  function handleAccountCreated() {
    setIsAccountFormOpen(false);
    checkAccounts();
    onAccountCreated?.();
  }

  // If there's no account, show the dialog
  if (open && hasAccount === false && !isChecking) {
    return (
      <>
        <Dialog open={open} onOpenChange={onOpenChange}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Account Required</DialogTitle>
            </DialogHeader>
            <div className="py-4 px-6">
              <DialogDescription>
                You need to create at least one account before creating transactions, budgets, goals, debts, or investments.
              </DialogDescription>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateAccount}>
                Create Account
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <AccountForm
          open={isAccountFormOpen}
          onOpenChange={setIsAccountFormOpen}
          onSuccess={handleAccountCreated}
        />
      </>
    );
  }

  // If checking or already has account, don't show anything
  return null;
}

