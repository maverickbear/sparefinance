"use client";

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/components/toast-provider';
import { format } from 'date-fns';
import { RefreshCw, Unlink, Loader2, CheckCircle2, Clock, AlertCircle, AlertTriangle, RotateCcw } from 'lucide-react';
import { useConfirmDialog } from '@/hooks/use-confirm-dialog';
import { ReconnectBankButton } from '@/src/presentation/components/features/accounts/reconnect-bank-button';

interface BankConnectionStatusProps {
  accountId: string;
  onDisconnect?: () => void;
  onSync?: () => void;
  embedded?: boolean; // If true, don't render outer Card
}

interface ConnectionStatus {
  isConnected: boolean;
  lastSyncedAt: string | null;
  syncEnabled: boolean;
  institutionName: string | null;
  institutionLogo: string | null;
  // Plaid status fields
  status?: string;
  errorCode?: string | null;
  errorMessage?: string | null;
  isSyncing?: boolean;
  syncStartedAt?: string | null;
  lastSuccessfulUpdate?: string | null;
  itemId?: string;
}

export function BankConnectionStatus({
  accountId,
  onDisconnect,
  onSync,
  embedded = false,
}: BankConnectionStatusProps) {
  const { toast } = useToast();
  const { openDialog, ConfirmDialog } = useConfirmDialog();
  const [status, setStatus] = useState<ConnectionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  useEffect(() => {
    loadStatus();
  }, [accountId]);

  async function loadStatus() {
    try {
      setLoading(true);
      
      // Try to get Plaid status first
      const plaidStatusResponse = await fetch(`/api/v2/plaid/accounts/${accountId}/status`);
      if (plaidStatusResponse.ok) {
        const plaidData = await plaidStatusResponse.json();
        setStatus({
          isConnected: plaidData.isConnected || false,
          lastSyncedAt: plaidData.lastSyncedAt || plaidData.lastSuccessfulUpdate,
          syncEnabled: plaidData.syncEnabled !== false,
          institutionName: plaidData.institutionName || null,
          institutionLogo: null, // Will be fetched separately if needed
          status: plaidData.status,
          errorCode: plaidData.errorCode,
          errorMessage: plaidData.errorMessage,
          isSyncing: plaidData.isSyncing,
          syncStartedAt: plaidData.syncStartedAt,
          lastSuccessfulUpdate: plaidData.lastSuccessfulUpdate,
          itemId: plaidData.itemId,
        });
        return;
      }

      // Fallback to regular account endpoint
      const response = await fetch(`/api/v2/accounts/${accountId}`);
      const data = await response.json();

      if (response.ok && data) {
        setStatus({
          isConnected: data.isConnected || false,
          lastSyncedAt: data.lastSyncedAt,
          syncEnabled: data.syncEnabled !== false,
          institutionName: data.institutionName || null,
          institutionLogo: data.institutionLogo || null,
        });
      }
    } catch (error) {
      console.error('Error loading connection status:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSync() {
    if (!status?.itemId) {
      toast({
        title: 'Sync unavailable',
        description: 'This account is not connected to Plaid.',
        variant: 'default',
      });
      return;
    }

    try {
      setSyncing(true);
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
        await loadStatus();
        if (onSync) {
          onSync();
        }
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
      setSyncing(false);
    }
  }

  function handleDisconnect() {
    if (!status?.itemId) {
      toast({
        title: 'Disconnect unavailable',
        description: 'This account is not connected to Plaid.',
        variant: 'default',
      });
      return;
    }

    openDialog(
      {
        title: "Disconnect Bank Account",
        description: "Are you sure you want to disconnect this bank account? You will need to reconnect it to sync transactions again.",
        variant: "destructive",
        confirmLabel: "Disconnect",
      },
      async () => {
        try {
          setDisconnecting(true);
          const response = await fetch(`/api/v2/plaid/items/${status.itemId}/disconnect`, {
            method: 'DELETE',
          });

          const data = await response.json();

          if (response.ok) {
            toast({
              title: 'Account disconnected',
              description: 'The bank account has been disconnected successfully.',
              variant: 'success',
            });

            await loadStatus();
            if (onDisconnect) {
              onDisconnect();
            }
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
          setDisconnecting(false);
        }
      }
    );
  }

  if (loading) {
    const loadingContent = (
      <div className="flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Loading connection status...</span>
      </div>
    );

    if (embedded) {
      return loadingContent;
    }

    return (
      <Card>
        <CardContent className="pt-6">
          {loadingContent}
        </CardContent>
      </Card>
    );
  }

  if (!status || !status.isConnected) {
    return null;
  }

  const headerContent = embedded ? null : (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2.5">
        {status.institutionLogo && (
          <img 
            src={status.institutionLogo} 
            alt={status.institutionName || 'Bank logo'} 
            className="h-5 w-5 rounded object-contain"
          />
        )}
        <div className="min-w-0">
          <CardTitle className="text-sm font-medium">Bank Connection</CardTitle>
          {status.institutionName && (
            <p className="text-xs text-muted-foreground mt-0.5 truncate">
              {status.institutionName}
            </p>
          )}
        </div>
      </div>
      {(() => {
        if (status.isSyncing) {
          return (
            <Badge variant="outline" className="text-xs bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800">
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              Syncing...
            </Badge>
          );
        }
        if (status.status === 'error' || status.status === 'item_login_required') {
          return (
            <Badge variant="outline" className="text-xs bg-red-50 text-red-600 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800">
              <AlertCircle className="h-3 w-3 mr-1" />
              {status.status === 'item_login_required' ? 'Reconnect Required' : 'Error'}
            </Badge>
          );
        }
        if (status.status === 'pending_expiration') {
          return (
            <Badge variant="outline" className="text-xs bg-yellow-50 text-yellow-600 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400 dark:border-yellow-800">
              <AlertTriangle className="h-3 w-3 mr-1" />
              Expiring Soon
            </Badge>
          );
        }
        return (
          <Badge 
            variant="outline" 
            className="text-xs bg-sentiment-positive/10 text-sentiment-positive border-sentiment-positive/30"
          >
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Connected
          </Badge>
        );
      })()}
    </div>
  );

  const mainContent = (
    <div className="space-y-3">
      {/* Error message */}
      {status.status === 'error' && status.errorMessage && (
        <div className="rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-red-800 dark:text-red-300">
                {status.errorCode === 'ITEM_LOGIN_REQUIRED' 
                  ? 'Reconnection Required'
                  : status.errorCode === 'USER_PERMISSION_REVOKED'
                  ? 'Access Revoked'
                  : 'Connection Error'}
              </p>
              <p className="text-xs text-red-700 dark:text-red-400 mt-1">
                {status.errorCode === 'ITEM_LOGIN_REQUIRED'
                  ? 'Please reconnect your bank account to continue syncing transactions.'
                  : status.errorMessage}
              </p>
              {status.errorCode === 'ITEM_LOGIN_REQUIRED' && (
                <ReconnectBankButton
                  accountId={accountId}
                  itemId={status.itemId}
                  onSuccess={() => {
                    loadStatus();
                    if (onSync) {
                      onSync();
                    }
                  }}
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Pending expiration warning */}
      {status.status === 'pending_expiration' && (
        <div className="rounded-md bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 p-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-yellow-800 dark:text-yellow-300">
                Connection Expiring Soon
              </p>
              <p className="text-xs text-yellow-700 dark:text-yellow-400 mt-1">
                Your bank connection will expire soon. Please reconnect to continue syncing.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Last synced info */}
      {status.lastSyncedAt && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Clock className="h-3.5 w-3.5" />
          <span>Last synced: {format(new Date(status.lastSyncedAt), 'MMM dd, yyyy HH:mm')}</span>
        </div>
      )}

      {/* Sync in progress indicator */}
      {status.isSyncing && (
        <div className="flex items-center gap-2 text-xs text-blue-600 dark:text-blue-400">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          <span>Sync in progress...</span>
        </div>
      )}

      <div className="flex items-center gap-2.5">
        <Button
          variant="outline"
          size="medium"
          onClick={handleDisconnect}
          disabled={disconnecting || status.isSyncing}
          className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-900/20 dark:hover:text-red-300 transition-all"
        >
          {disconnecting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Disconnecting...
            </>
          ) : (
            <>
              <Unlink className="h-4 w-4 mr-2" />
              Disconnect
            </>
          )}
        </Button>
        <Button
          variant="default"
          size="medium"
          onClick={handleSync}
          disabled={syncing || status.isSyncing || status.status === 'error'}
          className="flex-1 transition-all shadow-sm hover:shadow-md"
        >
          {syncing ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Syncing...
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4 mr-2" />
              Sync Transactions
            </>
          )}
        </Button>
      </div>
    </div>
  );

  if (embedded) {
    return (
      <div className="space-y-3">
        {mainContent}
        {ConfirmDialog}
      </div>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          {headerContent}
        </CardHeader>
        <CardContent>
          {mainContent}
        </CardContent>
      </Card>
      {ConfirmDialog}
    </>
  );
}

