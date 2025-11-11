"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { useToast } from "@/components/toast-provider";
import { format } from "date-fns";
import { RefreshCw, Unlink, Loader2, CheckCircle2, Clock } from "lucide-react";
import { useConfirmDialog } from "@/hooks/use-confirm-dialog";

interface QuestradeConnectionStatusProps {
  onDisconnect?: () => void;
  onSync?: () => void;
  embedded?: boolean;
}

interface ConnectionStatus {
  isConnected: boolean;
  lastSyncedAt: string | null;
  accountsCount: number;
}

export function QuestradeConnectionStatus({
  onDisconnect,
  onSync,
  embedded = false,
}: QuestradeConnectionStatusProps) {
  const { toast } = useToast();
  const { openDialog, ConfirmDialog } = useConfirmDialog();
  const [status, setStatus] = useState<ConnectionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  useEffect(() => {
    loadStatus();
  }, []);

  async function loadStatus() {
    try {
      setLoading(true);
      const response = await fetch("/api/questrade/accounts");

      if (response.status === 404) {
        // No Questrade connection - this is a valid state
        setStatus({
          isConnected: false,
          lastSyncedAt: null,
          accountsCount: 0,
        });
        return;
      }

      if (!response.ok) {
        throw new Error(`Failed to fetch Questrade accounts: ${response.status}`);
      }

      const data = await response.json();

      if (data.accounts) {
        const connectedAccounts = data.accounts.filter(
          (acc: any) => acc.connected
        );
        setStatus({
          isConnected: connectedAccounts.length > 0,
          lastSyncedAt: null, // Can be enhanced to get from connection
          accountsCount: connectedAccounts.length,
        });
      } else {
        setStatus({
          isConnected: false,
          lastSyncedAt: null,
          accountsCount: 0,
        });
      }
    } catch (error) {
      // Only log actual errors, not 404s (which are expected when no connection exists)
      if (error instanceof Error && !error.message.includes("404")) {
        console.error("Error loading Questrade connection status:", error);
      }
      setStatus({
        isConnected: false,
        lastSyncedAt: null,
        accountsCount: 0,
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleSync() {
    try {
      setSyncing(true);
      const response = await fetch("/api/questrade/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          syncAccounts: true,
          syncHoldings: true,
          syncTransactions: true,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to sync Questrade data");
      }

      const results = data.results || {};
      const totalSynced =
        (results.accounts?.synced || 0) +
        (results.holdings?.synced || 0) +
        (results.transactions?.synced || 0);
      
      const balancesSynced = results.balances?.synced || 0;
      const balancesInfo = balancesSynced > 0 ? `, Balances: ${balancesSynced}` : "";

      toast({
        title: "Dados sincronizados",
        description: `Sincronizados ${totalSynced} itens. Contas: ${results.accounts?.synced || 0}, Posições: ${results.holdings?.synced || 0}, Transações: ${results.transactions?.synced || 0}${balancesInfo}`,
        variant: "success",
      });

      await loadStatus();
      if (onSync) {
        onSync();
      }
    } catch (error: any) {
      console.error("Error syncing Questrade data:", error);
      toast({
        title: "Erro",
        description: error.message || "Falha ao sincronizar dados da Questrade",
        variant: "destructive",
      });
    } finally {
      setSyncing(false);
    }
  }

  function handleDisconnect() {
    openDialog(
      {
        title: "Desconectar Questrade",
        description: "Tem certeza de que deseja desconectar sua conta Questrade? Isso removerá todas as conexões Questrade.",
        variant: "destructive",
        confirmLabel: "Desconectar",
      },
      async () => {
        try {
          setDisconnecting(true);
          const response = await fetch("/api/questrade/disconnect", {
            method: "POST",
          });

          const data = await response.json();

          if (!response.ok) {
            throw new Error(data.error || "Failed to disconnect Questrade account");
          }

          toast({
            title: "Conta desconectada",
            description:
              "Sua conta Questrade foi desconectada com sucesso.",
            variant: "success",
          });

          await loadStatus();
          if (onDisconnect) {
            onDisconnect();
          }
        } catch (error: any) {
          console.error("Error disconnecting Questrade account:", error);
          toast({
            title: "Erro",
            description: error.message || "Falha ao desconectar conta Questrade",
            variant: "destructive",
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
        <span className="text-sm text-muted-foreground">
          Loading connection status...
        </span>
      </div>
    );

    if (embedded) {
      return loadingContent;
    }

    return (
      <Card>
        <CardContent className="pt-6">{loadingContent}</CardContent>
      </Card>
    );
  }

  if (!status || !status.isConnected) {
    return null;
  }

  const headerContent = embedded ? null : (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2.5">
        <div className="min-w-0">
          <CardTitle className="text-sm font-medium">
            Questrade Connection
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-0.5">
            {status.accountsCount} account{status.accountsCount !== 1 ? "s" : ""}{" "}
            connected
          </p>
        </div>
      </div>
      <Badge
        variant="outline"
        className="text-xs bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800"
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
          <span>
            Last synced:{" "}
            {format(new Date(status.lastSyncedAt), "MMM dd, yyyy HH:mm")}
          </span>
        </div>
      )}
      <div className="flex items-center gap-2.5">
        <Button
          variant="outline"
          size={embedded ? "sm" : "medium"}
          onClick={handleDisconnect}
          disabled={disconnecting}
          className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-900/20 dark:hover:text-red-300 transition-all"
        >
          {disconnecting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Desconectando...
            </>
          ) : (
            <>
              <Unlink className="h-4 w-4 mr-2" />
              Desconectar
            </>
          )}
        </Button>
        <Button
          variant="default"
          size={embedded ? "sm" : "medium"}
          onClick={handleSync}
          disabled={syncing}
          className={embedded ? "transition-all shadow-sm hover:shadow-md" : "flex-1 transition-all shadow-sm hover:shadow-md"}
        >
          {syncing ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Sincronizando...
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4 mr-2" />
              Sincronizar
            </>
          )}
        </Button>
      </div>
    </div>
  );

  if (embedded) {
    return (
      <div className="flex items-center gap-2">
        {mainContent}
        {ConfirmDialog}
      </div>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-3">{headerContent}</CardHeader>
        <CardContent>{mainContent}</CardContent>
      </Card>
      {ConfirmDialog}
    </>
  );
}

