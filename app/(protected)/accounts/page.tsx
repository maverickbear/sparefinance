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
import { ConnectBankButton } from "@/components/banking/connect-bank-button";
import { PageHeader } from "@/components/common/page-header";
import { useWriteGuard } from "@/hooks/use-write-guard";
import { DeleteAccountWithTransferDialog } from "@/components/accounts/delete-account-with-transfer-dialog";
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
  const { checkWriteAccess, canWrite } = useWriteGuard();
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
      // OPTIMIZED: Skip investment balances calculation for Accounts page (not needed, saves ~1s)
      const data = await getAccountsClient({ includeInvestmentBalances: false });
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
          <ConnectBankButton
            onSuccess={() => {
              loadAccounts();
              toast({
                title: 'Bank account connected',
                description: 'Your bank account has been connected successfully.',
                variant: 'success',
              });
            }}
            variant="outline"
          />
          {accounts.length > 0 && canWrite && (
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
        <div className="flex items-center justify-center w-full h-full min-h-[400px]">
          <div className="w-full max-w-md text-center">
            <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <CreditCard className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-semibold mb-2">No accounts yet</h3>
            <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
              Connect your bank account or create a manual account to get started tracking your finances.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
              <ConnectBankButton
                onSuccess={() => {
                  loadAccounts();
                  toast({
                    title: 'Bank account connected',
                    description: 'Your bank account has been connected successfully.',
                    variant: 'success',
                  });
                }}
              />
              {canWrite && (
                <Button onClick={handleAddAccount} size="large" variant="outline">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Account
                </Button>
              )}
            </div>
          </div>
        </div>
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

      <DeleteAccountWithTransferDialog
        open={deleteAccountDialogOpen}
        onOpenChange={setDeleteAccountDialogOpen}
        accounts={accounts}
        accountToDelete={accountToDelete}
        transferToAccountId={transferToAccountId}
        onTransferToAccountIdChange={setTransferToAccountId}
        onConfirm={handleConfirmDeleteWithTransfer}
        onCancel={() => {
          setDeleteAccountDialogOpen(false);
          setAccountToDelete(null);
          setTransferToAccountId("");
        }}
      />

      {ConfirmDialog}

      {/* Mobile Floating Action Button */}
      {canWrite && (
        <div className="fixed bottom-20 right-4 z-[60] lg:hidden">
          <Button
            size="large"
            className="h-14 w-14 rounded-full shadow-lg"
            onClick={handleAddAccount}
          >
            <Plus className="h-6 w-6" />
          </Button>
        </div>
      )}
    </div>
  );
}

