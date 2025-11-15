"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Edit, Trash2, CreditCard, Loader2, RefreshCw, Unlink } from "lucide-react";
import { formatMoney } from "@/components/common/money";
import { AccountForm } from "@/components/forms/account-form";
import { TableSkeleton } from "@/components/ui/list-skeleton";
import { useToast } from "@/components/toast-provider";
import { useConfirmDialog } from "@/hooks/use-confirm-dialog";
import { EmptyState } from "@/components/common/empty-state";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
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
    } catch (error) {
      console.error("Error loading accounts:", error);
      setHasLoaded(true);
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
    <div className="space-y-4 md:space-y-6">
      <PageHeader
        title="Accounts"
        description="Manage your accounts and view balances"
      >
        <div className="flex gap-2">
          {accounts.length > 0 && (
            <Button
              onClick={handleAddAccount}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Account
            </Button>
          )}
        </div>
      </PageHeader>

      {loading && accounts.length > 0 ? (
        <TableSkeleton rowCount={5} />
      ) : accounts.length === 0 ? (
        <EmptyState
          icon={CreditCard}
          title="No accounts yet"
          description="Create your first account to get started tracking your finances."
          actionLabel="Add Account"
          onAction={handleAddAccount}
          actionIcon={Plus}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          {accounts.map((account) => {
            const isCreditCard = account.type === "credit" && account.creditLimit;
            const available = isCreditCard 
              ? (account.creditLimit! + account.balance) 
              : null;
            
            return (
              <Card 
                key={account.id}
                className="transition-all flex flex-col"
              >
                <CardHeader className="pb-3 p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      {account.institutionLogo ? (
                        <img 
                          src={account.institutionLogo} 
                          alt={account.institutionName || 'Bank logo'} 
                          className="h-6 w-6 rounded object-contain flex-shrink-0"
                        />
                      ) : null}
                      <div className="min-w-0 flex-1">
                        <CardTitle className="text-sm font-semibold truncate">{account.name}</CardTitle>
                        {account.institutionName && (
                          <p className="text-[10px] text-muted-foreground truncate">{account.institutionName}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-0.5 flex-shrink-0">
                      {account.isConnected && (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSync(account.id);
                            }}
                            disabled={syncingId === account.id}
                            title="Sync transactions"
                          >
                            {syncingId === account.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <RefreshCw className="h-3.5 w-3.5" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-orange-600 hover:text-orange-700 dark:text-orange-400 dark:hover:text-orange-300"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDisconnect(account.id);
                            }}
                            disabled={disconnectingId === account.id}
                            title="Disconnect account"
                          >
                            {disconnectingId === account.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Unlink className="h-3.5 w-3.5" />
                            )}
                          </Button>
                        </>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!checkWriteAccess()) return;
                          setSelectedAccount(account);
                          setIsFormOpen(true);
                        }}
                        title="Edit account"
                      >
                        <Edit className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!checkWriteAccess()) return;
                          handleDelete(account.id);
                        }}
                        disabled={deletingId === account.id || account.isConnected}
                        title={account.isConnected ? "Cannot delete connected account. Disconnect first." : "Delete account"}
                      >
                        {deletingId === account.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge variant="outline" className="capitalize text-[10px] px-1.5 py-0.5">
                      {account.type}
                    </Badge>
                    {account.householdName && (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5">
                        {account.householdName}
                      </Badge>
                    )}
                    {account.isConnected && (
                      <Badge variant="default" className="bg-green-600 dark:bg-green-500 text-white text-[10px] px-1.5 py-0.5">
                        Connected
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 flex-1 p-4 pt-0">
                  <div className="space-y-2">
                    <div>
                      <div className="text-[10px] text-muted-foreground mb-0.5">Balance</div>
                      <div className={cn(
                        "text-lg font-bold",
                        account.balance >= 0 
                          ? "text-green-600 dark:text-green-400" 
                          : "text-red-600 dark:text-red-400"
                      )}>
                        {formatMoney(account.balance)}
                      </div>
                    </div>
                    {isCreditCard && (
                      <div className="grid grid-cols-2 gap-2 pt-2 border-t">
                        <div>
                          <div className="text-[10px] text-muted-foreground mb-0.5">Credit Limit</div>
                          <div className="text-xs font-semibold">
                            {formatMoney(account.creditLimit!)}
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] text-muted-foreground mb-0.5">Available</div>
                          <div className={cn(
                            "text-xs font-semibold",
                            available !== null && available >= 0
                              ? "text-green-600 dark:text-green-400"
                              : "text-red-600 dark:text-red-400"
                          )}>
                            {available !== null ? formatMoney(available) : "-"}
                          </div>
                        </div>
                      </div>
                    )}
                    {account.isConnected && account.lastSyncedAt && (
                      <div className="text-[10px] text-muted-foreground pt-2 border-t">
                        Last synced: {format(new Date(account.lastSyncedAt), 'MMM dd, HH:mm')}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

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
    </div>
  );
}

