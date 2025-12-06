"use client";

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/components/toast-provider';
import { format } from 'date-fns';
import { RefreshCw, Unlink, Loader2, CheckCircle2, Clock } from 'lucide-react';
import { useConfirmDialog } from '@/hooks/use-confirm-dialog';

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
    try {
      setSyncing(true);
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

      await loadStatus();
      if (onSync) {
        onSync();
      }
    } catch (error: any) {
      console.error('Error syncing transactions:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to sync transactions',
        variant: 'destructive',
      });
    } finally {
      setSyncing(false);
    }
  }

  function handleDisconnect() {
    openDialog(
      {
        title: "Disconnect Bank Account",
        description: "Are you sure you want to disconnect this bank account?",
        variant: "destructive",
        confirmLabel: "Disconnect",
      },
      async () => {
        try {
          setDisconnecting(true);
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

          await loadStatus();
          if (onDisconnect) {
            onDisconnect();
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
      <Badge 
        variant="outline" 
        className="text-xs bg-sentiment-positive/10 text-sentiment-positive border-sentiment-positive/30"
      >
        Connected
      </Badge>
    </div>
  );

  const mainContent = (
    <div className="space-y-3">
      {status.lastSyncedAt && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Clock className="h-3.5 w-3.5" />
          <span>Last synced: {format(new Date(status.lastSyncedAt), 'MMM dd, yyyy HH:mm')}</span>
        </div>
      )}
      <div className="flex items-center gap-2.5">
        <Button
          variant="outline"
          size="medium"
          onClick={handleDisconnect}
          disabled={disconnecting}
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
          disabled={syncing}
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

