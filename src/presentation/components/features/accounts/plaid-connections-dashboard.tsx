"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, AlertCircle, AlertTriangle, RefreshCw, Clock, Building2, Unlink } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/components/toast-provider";
import { useConfirmDialog } from "@/hooks/use-confirm-dialog";
import { cn } from "@/lib/utils";
import { ReconnectBankButton } from "./reconnect-bank-button";

interface PlaidConnection {
  itemId: string;
  institutionName: string | null;
  status: string;
  errorCode: string | null;
  errorMessage: string | null;
  isSyncing: boolean;
  lastSuccessfulUpdate: string | null;
  accountCount: number;
  accountId?: string; // First account ID for reconnect button
}

interface PendingConnection {
  institutionName: string;
  timestamp: number;
  status: 'connecting';
}

export function PlaidConnectionsDashboard() {
  const { toast } = useToast();
  const { openDialog, ConfirmDialog } = useConfirmDialog();
  const [connections, setConnections] = useState<PlaidConnection[]>([]);
  const [pendingConnections, setPendingConnections] = useState<PendingConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [disconnectingItemId, setDisconnectingItemId] = useState<string | null>(null);

  const loadConnections = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/v2/plaid/connections");
      
      if (response.ok) {
        const data = await response.json();
        setConnections(data.connections || []);
      }
    } catch (error) {
      console.error("Error loading Plaid connections:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load pending connections from localStorage
  const loadPendingConnections = useCallback(() => {
    try {
      const stored = localStorage.getItem('plaid-pending-connections');
      if (!stored) {
        setPendingConnections([]);
        return;
      }

      const pending = JSON.parse(stored) as PendingConnection[];
      const now = Date.now();
      const fiveMinutes = 5 * 60 * 1000;

      // Filter out old entries (> 5 minutes) and update localStorage
      const validPending = pending.filter((conn) => {
        return (now - conn.timestamp) < fiveMinutes;
      });

      // Update localStorage if we removed old entries
      if (validPending.length !== pending.length) {
        localStorage.setItem('plaid-pending-connections', JSON.stringify(validPending));
      }

      setPendingConnections(validPending);
    } catch (error) {
      console.error('[PlaidConnectionsDashboard] Error loading pending connections:', error);
      setPendingConnections([]);
    }
  }, []);

  useEffect(() => {
    loadConnections();
    loadPendingConnections();

    // Listen for account-created event to refresh
    const handleAccountCreated = () => {
      // Small delay to ensure backend has processed
      setTimeout(() => {
        loadConnections();
        loadPendingConnections();
      }, 500);
    };

    window.addEventListener('account-created', handleAccountCreated);

    return () => {
      window.removeEventListener('account-created', handleAccountCreated);
    };
  }, [loadConnections, loadPendingConnections]);

  // Polling: Check for completed connections when there are pending ones
  useEffect(() => {
    if (pendingConnections.length === 0) {
      return; // No polling needed if no pending connections
    }

    const pollInterval = setInterval(() => {
      // Reload connections to check if pending ones are now complete
      loadConnections();
      loadPendingConnections();
    }, 2500); // Poll every 2.5 seconds

    return () => {
      clearInterval(pollInterval);
    };
  }, [pendingConnections.length, loadConnections, loadPendingConnections]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadConnections();
    loadPendingConnections();
    setRefreshing(false);
    toast({
      title: "Refreshed",
      description: "Plaid connections status updated.",
      variant: "success",
    });
  };

  const handleDisconnect = (itemId: string, institutionName: string | null) => {
    openDialog(
      {
        title: "Disconnect Bank Account",
        description: `Are you sure you want to disconnect ${institutionName || "this bank account"}? You will need to reconnect it to sync transactions again.`,
        variant: "destructive",
        confirmLabel: "Disconnect",
      },
      async () => {
        try {
          setDisconnectingItemId(itemId);
          const response = await fetch(`/api/v2/plaid/items/${itemId}/disconnect`, {
            method: 'DELETE',
          });

          const data = await response.json();

          if (response.ok) {
            toast({
              title: 'Account disconnected',
              description: 'The bank account has been disconnected successfully.',
              variant: 'success',
            });

            // Reload connections to update the list
            await loadConnections();
            loadPendingConnections();
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
          setDisconnectingItemId(null);
        }
      }
    );
  };

  const getStatusBadge = (connection: PlaidConnection) => {
    if (connection.isSyncing) {
      return (
        <Badge variant="outline" className="bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800">
          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
          Syncing...
        </Badge>
      );
    }

    switch (connection.status) {
      case "good":
        return (
          <Badge variant="outline" className="bg-green-50 text-green-600 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Connected
          </Badge>
        );
      case "error":
      case "item_login_required":
        return (
          <Badge variant="outline" className="bg-red-50 text-red-600 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800">
            <AlertCircle className="h-3 w-3 mr-1" />
            {connection.status === "item_login_required" ? "Reconnect Required" : "Error"}
          </Badge>
        );
      case "pending_expiration":
        return (
          <Badge variant="outline" className="bg-yellow-50 text-yellow-600 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400 dark:border-yellow-800">
            <AlertTriangle className="h-3 w-3 mr-1" />
            Expiring Soon
          </Badge>
        );
      default:
        return (
          <Badge variant="outline">
            {connection.status}
          </Badge>
        );
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // Render placeholder for pending connection
  const renderPendingConnection = (pending: PendingConnection) => (
    <div
      key={`pending-${pending.timestamp}`}
      className="rounded-lg border border-dashed border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-900/10 p-4 space-y-3 animate-pulse"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-semibold text-sm">
              {pending.institutionName}
            </h4>
            <Badge variant="outline" className="bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800">
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              Connecting...
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Setting up your bank connection
          </p>
        </div>
      </div>
    </div>
  );

  const hasConnections = connections.length > 0 || pendingConnections.length > 0;

  if (!hasConnections && !loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-8 text-muted-foreground">
            <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-sm">No bank connections found</p>
            <p className="text-xs mt-2">Connect a bank account to get started</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Bank Connections</CardTitle>
            <CardDescription>
              Manage your connected bank accounts
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="medium"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            {refreshing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Pending connections first */}
          {pendingConnections.map((pending) => renderPendingConnection(pending))}
          
          {/* Real connections */}
          {connections.map((connection) => (
            <div
              key={connection.itemId}
              className="rounded-lg border p-4 space-y-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-semibold text-sm">
                      {connection.institutionName || "Unknown Bank"}
                    </h4>
                    {getStatusBadge(connection)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {connection.accountCount} account{connection.accountCount !== 1 ? "s" : ""}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="medium"
                  onClick={() => handleDisconnect(connection.itemId, connection.institutionName)}
                  disabled={disconnectingItemId === connection.itemId}
                >
                  {disconnectingItemId === connection.itemId ? (
                    <>
                      <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                      Disconnecting...
                    </>
                  ) : (
                    <>
                      <Unlink className="h-3 w-3 mr-1.5" />
                      Disconnect
                    </>
                  )}
                </Button>
              </div>

              {/* Error message */}
              {(connection.status === "error" || connection.status === "item_login_required") && connection.errorMessage && (
                <div className="rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-red-800 dark:text-red-300">
                        {connection.errorCode === "ITEM_LOGIN_REQUIRED"
                          ? "Reconnection Required"
                          : connection.errorCode || "Connection Error"}
                      </p>
                      <p className="text-xs text-red-700 dark:text-red-400 mt-1">
                        {connection.errorCode === "ITEM_LOGIN_REQUIRED"
                          ? "Please reconnect your bank account to continue syncing transactions."
                          : connection.errorMessage}
                      </p>
                      {connection.status === "item_login_required" && connection.accountId && (
                        <div className="mt-2">
                          <ReconnectBankButton
                            accountId={connection.accountId}
                            itemId={connection.itemId}
                            onSuccess={() => loadConnections()}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Last update */}
              {connection.lastSuccessfulUpdate && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" />
                  <span>
                    Last synced: {format(new Date(connection.lastSuccessfulUpdate), "MMM dd, yyyy HH:mm")}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
      {ConfirmDialog}
    </Card>
  );
}
