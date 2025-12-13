"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { usePagePerformance } from "@/hooks/use-page-performance";
import { Button } from "@/components/ui/button";
import { Plus, CreditCard, Edit, Trash2, Loader2, AlertCircle } from "lucide-react";
import { AccountForm } from "@/components/forms/account-form";
import { useToast } from "@/components/toast-provider";
import { useConfirmDialog } from "@/hooks/use-confirm-dialog";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { useWriteGuard } from "@/hooks/use-write-guard";
import { ImportStatusBanner } from "@/src/presentation/components/features/accounts/import-status-banner";
import { DeleteAccountWithTransferDialog } from "@/src/presentation/components/features/accounts/delete-account-with-transfer-dialog";
import { AccountCard } from "@/components/banking/account-card";
import { AddAccountDropdown } from "@/src/presentation/components/features/accounts/add-account-dropdown";
import { PlaidConnectionsDashboard } from "@/src/presentation/components/features/accounts/plaid-connections-dashboard";
import { useBreakpoint } from "@/hooks/use-breakpoint";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatMoney } from "@/components/common/money";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { getInitials, isValidAvatarUrl } from "@/lib/utils/avatar";

interface Account {
  id: string;
  name: string;
  type: string;
  balance: number;
  creditLimit?: number | null;
  householdName?: string | null;
  ownerIds?: string[];
  ownerAvatarUrl?: string | null;
  ownerName?: string | null;
  isConnected?: boolean;
  lastSyncedAt?: string | null;
  institutionName?: string | null;
  institutionLogo?: string | null;
  plaidStatus?: string;
  plaidErrorCode?: string | null;
  plaidErrorMessage?: string | null;
  plaidIsSyncing?: boolean;
}


export default function AccountsPage() {
  const perf = usePagePerformance("Accounts");
  const perfRef = useRef(perf);
  const { toast } = useToast();
  const { openDialog, ConfirmDialog } = useConfirmDialog();
  const { checkWriteAccess, canWrite } = useWriteGuard();
  const breakpoint = useBreakpoint();
  const isDesktop = breakpoint === "lg" || breakpoint === "xl" || breakpoint === "2xl";
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [accountLimit, setAccountLimit] = useState<{ current: number; limit: number } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteAccountDialogOpen, setDeleteAccountDialogOpen] = useState(false);
  const [accountToDelete, setAccountToDelete] = useState<string | null>(null);
  const [transferToAccountId, setTransferToAccountId] = useState<string>("");
  const [checkingTransactions, setCheckingTransactions] = useState(false);
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [ownerFilter, setOwnerFilter] = useState<string>("all");
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null);

  // Update ref when perf changes (but don't trigger re-renders)
  useEffect(() => {
    perfRef.current = perf;
  }, [perf]);

  const loadAccounts = useCallback(async (forceRefresh = false) => {
    try {
      setLoading(true);
      // Use API route instead of client-side API
      // OPTIMIZED: Skip investment balances calculation for Accounts page (not needed, saves ~1s)
      // Add cache-busting timestamp when forceRefresh is true to bypass browser cache
      const url = forceRefresh 
        ? `/api/v2/accounts?includeHoldings=false&_t=${Date.now()}`
        : "/api/v2/accounts?includeHoldings=false";
      
      const response = await fetch(url, {
        cache: forceRefresh ? 'no-store' : 'default',
      });
      if (!response.ok) {
        throw new Error(`Failed to fetch accounts: ${response.statusText}`);
      }
      const data = await response.json();
      setAccounts(data);
      setHasLoaded(true);
      // Safely call markDataLoaded - perf object should always exist but add safety check
      if (perfRef.current?.markDataLoaded) {
        perfRef.current.markDataLoaded();
      }
    } catch (error) {
      console.error("Error loading accounts:", error);
      setHasLoaded(true);
      // Safely call markDataLoaded even on error
      if (perfRef.current?.markDataLoaded) {
        perfRef.current.markDataLoaded();
      }
      // Show error toast to user
      toast({
        title: "Error loading accounts",
        description: "Failed to load accounts. Please try refreshing the page.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  async function handleSync(accountId: string) {
    try {
      setSyncingId(accountId);
      const response = await fetch('/api/v2/plaid/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId }),
      });

      const data = await response.json();

      if (response.ok) {
        toast({
          title: 'Sync completed',
          description: `Created ${data.transactionsCreated || 0} transactions, skipped ${data.transactionsSkipped || 0} duplicates.`,
          variant: 'success',
        });
        // Reload accounts to update lastSyncedAt
        await loadAccounts(true);
      } else {
        throw new Error(data.error || 'Failed to sync');
      }
    } catch (error: any) {
      console.error('Error syncing account:', error);
      toast({
        title: 'Sync failed',
        description: error.message || 'Failed to sync transactions',
        variant: 'destructive',
      });
    } finally {
      setSyncingId(null);
    }
  }

  async function handleDisconnect(accountId: string) {
    try {
      // First, get the Plaid item ID for this account
      const statusResponse = await fetch(`/api/v2/plaid/accounts/${accountId}/status`);
      if (!statusResponse.ok) {
        throw new Error('Account is not connected to Plaid');
      }
      const statusData = await statusResponse.json();
      
      if (!statusData.itemId) {
        throw new Error('Account is not connected to Plaid');
      }

      setDisconnectingId(accountId);
      const response = await fetch(`/api/v2/plaid/items/${statusData.itemId}/disconnect`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (response.ok) {
        toast({
          title: 'Account disconnected',
          description: 'The bank account has been disconnected successfully.',
          variant: 'success',
        });
        // Reload accounts to update connection status
        await loadAccounts(true);
      } else {
        throw new Error(data.error || 'Failed to disconnect');
      }
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
    // Load limit before opening form/sheet for immediate display
    await loadAccountLimit();
    // The dropdown will handle opening the appropriate form
  }

  async function handleDelete(id: string) {
    if (!checkWriteAccess()) return;
    
    // Check if account has transactions
    setCheckingTransactions(true);
    try {
      const response = await fetch(`/api/v2/accounts/${id}/has-transactions`);
      
      if (!response.ok) {
        throw new Error("Failed to check transactions");
      }
      
      const { hasTransactions } = await response.json();
      
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
    
    // Set loading state - account stays visible in table with loading indicator
    setDeletingId(id);

    try {
      const response = await fetch(`/api/v2/accounts/${id}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ transferToAccountId: transferToId }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete account");
      }

      toast({
        title: "Account deleted",
        description: transferToId 
          ? "Your account has been deleted and all transactions have been transferred."
          : "Your account has been deleted successfully.",
        variant: "success",
      });
      
      // Remove from list after successful deletion (no need to reload entire page)
      setAccounts(prev => prev.filter(a => a.id !== id));
      
      // Update account limit without reloading all accounts
      loadAccountLimit();
    } catch (error) {
      console.error("Error deleting account:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete account",
        variant: "destructive",
      });
    } finally {
      setDeletingId(null);
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

    // Save values before closing dialog
    const accountIdToDelete = accountToDelete;
    const transferToId = transferToAccountId;
    
    // Close dialog immediately
    setDeleteAccountDialogOpen(false);
    setAccountToDelete(null);
    setTransferToAccountId("");
    
    // Start deletion immediately - loading will show in the table row
    // Dialog is already closed, user can continue using the app
    performDelete(accountIdToDelete, transferToId);
  }


  // Get unique account types and owners for filters
  const uniqueTypes = useMemo(() => {
    const types = new Set(accounts.map(acc => acc.type));
    return Array.from(types).sort();
  }, [accounts]);

  const uniqueOwners = useMemo(() => {
    const owners = new Set(
      accounts
        .map(acc => acc.householdName)
        .filter((name): name is string => name !== null && name !== undefined)
    );
    return Array.from(owners).sort();
  }, [accounts]);

  // Filter accounts based on selected filters
  const filteredAccounts = useMemo(() => {
    return accounts.filter(account => {
      // Filter by type
      if (typeFilter !== "all" && account.type !== typeFilter) {
        return false;
      }

      // Filter by owner
      if (ownerFilter !== "all") {
        if (!account.householdName || account.householdName !== ownerFilter) {
          return false;
        }
      }

      return true;
    });
  }, [accounts, typeFilter, ownerFilter]);

  // Type display names
  const typeDisplayNames: Record<string, string> = {
    checking: "Checking",
    savings: "Savings",
    credit: "Credit Card",
    cash: "Cash",
    investment: "Investment",
    other: "Other",
  };

  return (
    <div>
        <PageHeader
          title="Accounts"
        >
        <div className="flex gap-2">
          {accounts.length > 0 && canWrite && (
            <AddAccountDropdown
              onSuccess={() => {
                loadAccounts(true);
              }}
              canWrite={canWrite}
            />
          )}
        </div>
      </PageHeader>

      <div className="w-full p-4 lg:p-8">
        <ImportStatusBanner />
        
        {/* Plaid Connections Dashboard */}
        <div className="mb-6">
          <PlaidConnectionsDashboard />
        </div>

        <div className="space-y-4">
          {/* Filters - Only show when we have accounts or are loading */}
          {(accounts.length > 0 || loading) && (
            <div className="flex flex-row gap-2 sm:gap-4 items-center">
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="h-9 w-auto min-w-[140px]">
                  <SelectValue placeholder="Account Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {uniqueTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {typeDisplayNames[type] || type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={ownerFilter} onValueChange={setOwnerFilter}>
                <SelectTrigger className="h-9 w-auto min-w-[140px]">
                  <SelectValue placeholder="Owner" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Owners</SelectItem>
                  {uniqueOwners.map((owner) => (
                    <SelectItem key={owner} value={owner}>
                      {owner}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Desktop Table */}
          <div className="hidden lg:block rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Account Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Bank</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead className="text-right">Credit Limit</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      Loading accounts...
                    </TableCell>
                  </TableRow>
                ) : accounts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8">
                      <div className="flex flex-col items-center justify-center w-full max-w-md mx-auto">
                        <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                          <CreditCard className="h-8 w-8 text-muted-foreground" />
                        </div>
                        <h3 className="text-xl font-semibold mb-2">No accounts yet</h3>
                        <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
                          Connect your bank account or create a manual account to get started tracking your finances.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
                          {canWrite && (
                            <Button onClick={handleAddAccount} size="medium" variant="outline">
                              <Plus className="mr-2 h-4 w-4" />
                              Add Account
                            </Button>
                          )}
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filteredAccounts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      No accounts found matching the selected filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredAccounts.map((account) => {
                    const isCreditCard = account.type === "credit" && account.creditLimit;
                    const available = isCreditCard 
                      ? (account.creditLimit! + account.balance) 
                      : null;

                    const isDeleting = deletingId === account.id;

                    return (
                      <TableRow 
                        key={account.id}
                        className={cn(
                          isDeleting && "opacity-50 pointer-events-none"
                        )}
                      >
                        <TableCell>
                          {isDeleting && (
                            <div className="flex items-center gap-2 mb-1">
                              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                              <span className="text-xs text-muted-foreground">Deleting...</span>
                            </div>
                          )}
                          <div className="flex items-center gap-2">
                            {account.institutionLogo && (
                              <img 
                                src={account.institutionLogo} 
                                alt={account.institutionName || 'Bank logo'} 
                                className="h-5 w-5 rounded object-contain"
                              />
                            )}
                            <div>
                              <div className="font-medium">{account.name}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">
                            {typeDisplayNames[account.type] || account.type}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {account.institutionName ? (
                            <div className="flex items-center gap-2">
                              {account.institutionLogo && (
                                <img 
                                  src={account.institutionLogo} 
                                  alt={account.institutionName} 
                                  className="h-4 w-4 rounded object-contain"
                                />
                              )}
                              <span className="text-sm">{account.institutionName}</span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {account.householdName ? (
                            <div className="flex items-center gap-2">
                              <div className="relative flex-shrink-0">
                                {isValidAvatarUrl(account.ownerAvatarUrl) ? (
                                  <>
                                    <img
                                      src={account.ownerAvatarUrl!}
                                      alt={account.ownerName || account.householdName || "Owner"}
                                      className="h-8 w-8 rounded-full object-cover border"
                                      loading="eager"
                                      decoding="async"
                                      onError={(e) => {
                                        const img = e.currentTarget;
                                        img.style.display = "none";
                                        const initialsContainer = img.nextElementSibling as HTMLElement;
                                        if (initialsContainer) {
                                          initialsContainer.style.display = "flex";
                                        }
                                      }}
                                    />
                                    <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground hidden items-center justify-center text-xs font-semibold border absolute top-0 left-0">
                                      {getInitials(account.ownerName || account.householdName)}
                                    </div>
                                  </>
                                ) : (
                                  <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-semibold border">
                                    {getInitials(account.ownerName || account.householdName)}
                                  </div>
                                )}
                              </div>
                              <span className="text-sm">{account.householdName}</span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className={cn(
                            "font-semibold",
                            account.balance >= 0 
                              ? "text-green-600 dark:text-green-400" 
                              : "text-red-600 dark:text-red-400"
                          )}>
                            {formatMoney(account.balance)}
                          </div>
                          {isCreditCard && available !== null && (
                            <div className="text-xs text-muted-foreground mt-1">
                              Available: {formatMoney(available)}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {isCreditCard ? (
                            <span className="font-medium">{formatMoney(account.creditLimit!)}</span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            {account.isConnected && (
                              <Badge 
                                variant="default" 
                                className={cn(
                                  "text-white text-xs w-fit",
                                  account.plaidStatus === 'error' || account.plaidStatus === 'item_login_required'
                                    ? "bg-red-500 hover:bg-red-600"
                                    : account.plaidStatus === 'pending_expiration'
                                    ? "bg-yellow-500 hover:bg-yellow-600"
                                    : account.plaidIsSyncing
                                    ? "bg-blue-500 hover:bg-blue-600"
                                    : "bg-sentiment-positive hover:bg-sentiment-positive/90"
                                )}
                              >
                                {account.plaidIsSyncing 
                                  ? "Syncing..." 
                                  : account.plaidStatus === 'error' || account.plaidStatus === 'item_login_required'
                                  ? "Error"
                                  : account.plaidStatus === 'pending_expiration'
                                  ? "Expiring"
                                  : "Connected"}
                              </Badge>
                            )}
                            {account.isConnected && account.lastSyncedAt && (() => {
                              try {
                                const syncDate = new Date(account.lastSyncedAt);
                                // Check if date is valid
                                if (isNaN(syncDate.getTime())) {
                                  return null;
                                }
                                return (
                                  <div className="text-xs text-muted-foreground">
                                    {format(syncDate, 'MMM dd, HH:mm')}
                                  </div>
                                );
                              } catch (error) {
                                console.error("Error formatting lastSyncedAt:", error);
                                return null;
                              }
                            })()}
                            {/* Error indicator */}
                            {(account.plaidStatus === 'error' || account.plaidStatus === 'item_login_required') && account.plaidErrorMessage && (
                              <div className="text-xs text-red-600 dark:text-red-400 mt-1">
                                {account.plaidErrorCode === 'ITEM_LOGIN_REQUIRED'
                                  ? 'Reconnection required'
                                  : account.plaidErrorMessage.substring(0, 50) + (account.plaidErrorMessage.length > 50 ? '...' : '')}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {canWrite && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  if (!checkWriteAccess()) return;
                                  setSelectedAccount(account);
                                  setIsFormOpen(true);
                                }}
                                title="Edit account"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                            )}
                            {canWrite && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-destructive hover:text-destructive"
                                onClick={() => {
                                  if (!checkWriteAccess()) return;
                                  handleDelete(account.id);
                                }}
                                disabled={isDeleting || account.isConnected}
                                title={account.isConnected ? "Cannot delete connected account. Disconnect first." : "Delete account"}
                              >
                                {isDeleting ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Trash2 className="h-4 w-4" />
                                )}
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {/* Mobile Cards */}
          <div className="lg:hidden space-y-3">
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">
                Loading accounts...
              </div>
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
                      {canWrite && (
                        <Button onClick={handleAddAccount} size="medium" variant="outline">
                          <Plus className="mr-2 h-4 w-4" />
                          Add Account
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : filteredAccounts.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No accounts found matching the selected filters.
              </div>
            ) : (
              filteredAccounts.map((account) => {
                const isDeleting = deletingId === account.id;
                
                return (
                  <div
                    key={account.id}
                    className={cn(
                      isDeleting && "opacity-50 pointer-events-none"
                    )}
                  >
                    {isDeleting && (
                      <div className="flex items-center gap-2 mb-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Deleting...</span>
                      </div>
                    )}
                    <AccountCard
                      account={account}
                      onEdit={(id) => {
                        if (!checkWriteAccess()) return;
                        const accountToEdit = accounts.find(a => a.id === id);
                        if (accountToEdit) {
                          setSelectedAccount(accountToEdit);
                          setIsFormOpen(true);
                        }
                      }}
                      onDelete={handleDelete}
                      onSync={handleSync}
                      onDisconnect={handleDisconnect}
                      deletingId={deletingId}
                      syncingId={syncingId}
                      disconnectingId={disconnectingId}
                      canDelete={canWrite}
                      canEdit={canWrite}
                    />
                  </div>
                );
              })
            )}
          </div>
        </div>
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
          loadAccounts(true); // Force refresh to bypass cache
          loadAccountLimit();
        }}
        initialAccountLimit={accountLimit}
      />

      <DeleteAccountWithTransferDialog
        open={deleteAccountDialogOpen}
        onOpenChange={(open) => {
          setDeleteAccountDialogOpen(open);
          if (!open) {
            // Reset state when dialog closes
            setAccountToDelete(null);
            setTransferToAccountId("");
          }
        }}
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

      {/* Mobile Fixed Button - Above bottom nav */}
      {canWrite && accounts.length > 0 && (
        <div className="fixed bottom-20 left-0 right-0 z-[60] lg:hidden px-4">
          <Button
            size="medium"
            className="w-full"
            onClick={handleAddAccount}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Account
          </Button>
        </div>
      )}

      </div>
  );
}

