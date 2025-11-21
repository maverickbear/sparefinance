"use client";

import React, { useState, useEffect } from "react";
import { usePagePerformance } from "@/hooks/use-page-performance";
import { Button } from "@/components/ui/button";
import { Plus, CreditCard } from "lucide-react";
import { AccountForm } from "@/components/forms/account-form";
import { TableSkeleton } from "@/components/ui/list-skeleton";
import { useToast } from "@/components/toast-provider";
import { useConfirmDialog } from "@/hooks/use-confirm-dialog";
import { EmptyState } from "@/components/common/empty-state";
import { AccountCard } from "@/components/banking/account-card";
import { PageHeader } from "@/components/common/page-header";
import { useWriteGuard } from "@/hooks/use-write-guard";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Account {
  id: string;
  name: string;
  type: string;
  balance: number;
  creditLimit?: number | null;
  householdName?: string | null;
  ownerIds?: string[];
  isConnected?: boolean;
  lastSyncedAt?: string | null;
  institutionName?: string | null;
  institutionLogo?: string | null;
}

export default function AccountsPage() {
  const perf = usePagePerformance("Accounts");
  const { toast } = useToast();
  const { openDialog, ConfirmDialog } = useConfirmDialog();
  const { checkWriteAccess } = useWriteGuard();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [accountLimit, setAccountLimit] = useState<{ current: number; limit: number } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null);
  const [deleteAccountDialogOpen, setDeleteAccountDialogOpen] = useState(false);
  const [accountToDelete, setAccountToDelete] = useState<string | null>(null);
  const [transferToAccountId, setTransferToAccountId] = useState<string>("");
  const [checkingTransactions, setCheckingTransactions] = useState(false);

  useEffect(() => {
    loadAccounts();
  }, []);

  async function loadAccounts() {
    try {
      setLoading(true);
      const { getAccountsClient } = await import("@/lib/api/accounts-client");
      const data = await getAccountsClient();
      setAccounts(data);
      setHasLoaded(true);
      perf.markDataLoaded();
    } catch (error) {
      console.error("Error loading accounts:", error);
      setHasLoaded(true);
      perf.markDataLoaded();
    } finally {
      setLoading(false);
    }
  }

  async function loadAccountLimit() {
    try {
      const { getBillingLimitsAction } = await import("@/lib/actions/billing");
      const limits = await getBillingLimitsAction();
      if (limits?.accountLimit) {
        setAccountLimit({
          current: limits.accountLimit.current,
          limit: limits.accountLimit.limit,
        });
      }
    } catch (error) {
      console.error("Error loading account limit:", error);
    }
  }

  async function handleAddAccount() {
    if (!checkWriteAccess()) return;
    setSelectedAccount(null);
    // Load limit before opening modal for immediate display
    await loadAccountLimit();
    setIsFormOpen(true);
  }

  async function handleDelete(id: string) {
    if (!checkWriteAccess()) return;
    
    // Check if account has transactions
    setCheckingTransactions(true);
    try {
      const { accountHasTransactionsClient } = await import("@/lib/api/accounts-client");
      const hasTransactions = await accountHasTransactionsClient(id);
      
      if (hasTransactions) {
        // Open dialog to select destination account
        setAccountToDelete(id);
        setTransferToAccountId("");
        setDeleteAccountDialogOpen(true);
        setCheckingTransactions(false);
        return;
      }
    } catch (error) {
      console.error("Error checking transactions:", error);
      // If we can't check, assume there are transactions to be safe
      setAccountToDelete(id);
      setTransferToAccountId("");
      setDeleteAccountDialogOpen(true);
      setCheckingTransactions(false);
      return;
    }
    setCheckingTransactions(false);

    // If no transactions, proceed with deletion
    openDialog(
      {
        title: "Delete Account",
        description: "Are you sure you want to delete this account?",
        variant: "destructive",
        confirmLabel: "Delete",
      },
      async () => {
        await performDelete(id);
      }
    );
  }

  async function performDelete(id: string, transferToId?: string) {
    const accountToDelete = accounts.find(a => a.id === id);
    
    // Optimistic update: remove from UI immediately
    setAccounts(prev => prev.filter(a => a.id !== id));
    setDeletingId(id);

    try {
      const { deleteAccountClient } = await import("@/lib/api/accounts-client");
      await deleteAccountClient(id, transferToId);

      toast({
        title: "Account deleted",
        description: transferToId 
          ? "Your account has been deleted and all transactions have been transferred."
          : "Your account has been deleted successfully.",
        variant: "success",
      });
      
      loadAccounts();
      // Reload limit after deletion
      loadAccountLimit();
    } catch (error) {
      console.error("Error deleting account:", error);
      // Revert optimistic update on error
      if (accountToDelete) {
        setAccounts(prev => [...prev, accountToDelete].sort((a, b) => a.name.localeCompare(b.name)));
      }
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete account",
        variant: "destructive",
      });
    } finally {
      setDeletingId(null);
      setDeleteAccountDialogOpen(false);
      setAccountToDelete(null);
      setTransferToAccountId("");
    }
  }

  async function handleConfirmDeleteWithTransfer() {
    if (!accountToDelete) return;
    
    if (!transferToAccountId) {
      toast({
        title: "Account Required",
        description: "Please select a destination account to transfer transactions to.",
        variant: "destructive",
      });
      return;
    }

    await performDelete(accountToDelete, transferToAccountId);
  }

  async function handleSync(accountId: string) {
    try {
      setSyncingId(accountId);
      const response = await fetch('/api/plaid/sync-transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to sync transactions');
      }

      toast({
        title: 'Transactions synced',
        description: `Synced ${data.synced} new transactions. ${data.skipped} were skipped.`,
        variant: 'success',
      });

      await loadAccounts();
    } catch (error: any) {
      console.error('Error syncing transactions:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to sync transactions',
        variant: 'destructive',
      });
    } finally {
      setSyncingId(null);
    }
  }

  async function handleDisconnect(accountId: string) {
    if (!confirm('Are you sure you want to disconnect this bank account?')) {
      return;
    }

    try {
      setDisconnectingId(accountId);
      const response = await fetch('/api/plaid/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to disconnect account');
      }

      toast({
        title: 'Account disconnected',
        description: 'The bank account has been disconnected successfully.',
        variant: 'success',
      });

      await loadAccounts();
    } catch (error: any) {
      console.error('Error disconnecting account:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to disconnect account',
        variant: 'destructive',
      });
    } finally {
      setDisconnectingId(null);
    }
  }


  return (
    <div>
      <PageHeader
        title="Accounts"
      >
        <div className="flex gap-2">
          {accounts.length > 0 && (
            <Button
              size="medium"
              onClick={handleAddAccount}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Account
            </Button>
          )}
        </div>
      </PageHeader>

      <div className="w-full p-4 lg:p-8">
        {loading && accounts.length > 0 ? (
        <TableSkeleton rowCount={5} />
      ) : accounts.length === 0 ? (
        <div className="w-full h-full min-h-[400px]">
        <EmptyState
          icon={CreditCard}
          title="No accounts yet"
          description="Create your first account to get started tracking your finances."
          actionLabel="Add Account"
          onAction={handleAddAccount}
          actionIcon={Plus}
        />
        </div>
      ) : (() => {
        // Group accounts by type
        const accountsByType = accounts.reduce((acc, account) => {
          const type = account.type;
          if (!acc[type]) {
            acc[type] = [];
          }
          acc[type].push(account);
          return acc;
        }, {} as Record<string, Account[]>);

        // Define type display names
        const typeDisplayNames: Record<string, string> = {
          checking: "Checking",
          savings: "Savings",
          credit: "Credit Card",
          cash: "Cash",
          investment: "Investment",
          other: "Other",
        };

        // Define type order for consistent display
        const typeOrder = ["checking", "savings", "credit", "cash", "investment", "other"];

        return (
          <div className="space-y-6">
            {typeOrder.map((type) => {
              const typeAccounts = accountsByType[type];
              if (!typeAccounts || typeAccounts.length === 0) return null;

              return (
                <div key={type} className="space-y-3">
                  <h2 className="text-lg font-semibold capitalize">
                    {typeDisplayNames[type] || type}
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
                    {typeAccounts.map((account) => (
                      <AccountCard
                        key={account.id}
                        account={account}
                        onEdit={(id) => {
                          if (!checkWriteAccess()) return;
                          const accountToEdit = accounts.find(a => a.id === id);
                          if (accountToEdit) {
                            setSelectedAccount(accountToEdit);
                            setIsFormOpen(true);
                          }
                        }}
                        onDelete={(id) => {
                          if (!checkWriteAccess()) return;
                          handleDelete(id);
                        }}
                        onSync={handleSync}
                        onDisconnect={handleDisconnect}
                        deletingId={deletingId}
                        syncingId={syncingId}
                        disconnectingId={disconnectingId}
                        canDelete={checkWriteAccess()}
                        canEdit={checkWriteAccess()}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })()}
      </div>

      <AccountForm
        open={isFormOpen}
        onOpenChange={(open) => {
          setIsFormOpen(open);
          if (!open) {
            setAccountLimit(null);
          }
        }}
        account={selectedAccount || undefined}
        onSuccess={() => {
          loadAccounts();
          loadAccountLimit();
        }}
        initialAccountLimit={accountLimit}
      />

      {/* Delete Account with Transfer Dialog */}
      <Dialog open={deleteAccountDialogOpen} onOpenChange={setDeleteAccountDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Account</DialogTitle>
            <DialogDescription>
              This account has associated transactions. Please select a destination account to transfer all transactions to before deleting.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Transfer transactions to:</label>
              <Select
                value={transferToAccountId}
                onValueChange={setTransferToAccountId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select destination account" />
                </SelectTrigger>
                <SelectContent>
                  {accounts
                    .filter((account) => account.id !== accountToDelete)
                    .map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.name} ({account.type})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              {accounts.filter((account) => account.id !== accountToDelete).length === 0 && (
                <p className="text-sm text-muted-foreground">
                  You need at least one other account to transfer transactions to. Please create another account first.
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteAccountDialogOpen(false);
                setAccountToDelete(null);
                setTransferToAccountId("");
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDeleteWithTransfer}
              disabled={!transferToAccountId || accounts.filter((account) => account.id !== accountToDelete).length === 0}
            >
              Delete and Transfer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {ConfirmDialog}

      {/* Mobile Floating Action Button */}
      <div className="fixed bottom-20 right-4 z-[60] lg:hidden">
        <Button
          size="large"
          className="h-14 w-14 rounded-full shadow-lg"
          onClick={handleAddAccount}
        >
          <Plus className="h-6 w-6" />
        </Button>
      </div>
    </div>
  );
}

