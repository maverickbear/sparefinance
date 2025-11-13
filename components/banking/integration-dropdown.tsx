"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChevronDown, RefreshCw, Unlink, Loader2, Plus, ExternalLink } from "lucide-react";
import { useToast } from "@/components/toast-provider";
import { FeatureGuard } from "@/components/common/feature-guard";
import { useConfirmDialog } from "@/hooks/use-confirm-dialog";
import { useWriteGuard } from "@/hooks/use-write-guard";

interface IntegrationDropdownProps {
  onSync?: () => void;
  onDisconnect?: () => void;
  onSuccess?: () => void;
}

interface ConnectionStatus {
  isConnected: boolean;
  accountsCount: number;
}

export function IntegrationDropdown({
  onSync,
  onDisconnect,
  onSuccess,
}: IntegrationDropdownProps) {
  const { toast } = useToast();
  const { openDialog, ConfirmDialog } = useConfirmDialog();
  const { checkWriteAccess } = useWriteGuard();
  const [questradeStatus, setQuestradeStatus] = useState<ConnectionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [showConnectDialog, setShowConnectDialog] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [manualAuthToken, setManualAuthToken] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);

  useEffect(() => {
    loadStatus();
  }, []);

  async function loadStatus() {
    try {
      setLoading(true);
      const response = await fetch("/api/questrade/accounts");

      if (response.status === 404) {
        setQuestradeStatus({
          isConnected: false,
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
        setQuestradeStatus({
          isConnected: connectedAccounts.length > 0,
          accountsCount: connectedAccounts.length,
        });
      } else {
        setQuestradeStatus({
          isConnected: false,
          accountsCount: 0,
        });
      }
    } catch (error) {
      if (error instanceof Error && !error.message.includes("404")) {
        console.error("Error loading Questrade connection status:", error);
      }
      setQuestradeStatus({
        isConnected: false,
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
        title: "Data synced",
        description: `Synced ${totalSynced} items. Accounts: ${results.accounts?.synced || 0}, Holdings: ${results.holdings?.synced || 0}, Transactions: ${results.transactions?.synced || 0}${balancesInfo}`,
        variant: "success",
      });

      await loadStatus();
      if (onSync) {
        onSync();
      }
    } catch (error: any) {
      console.error("Error syncing Questrade data:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to sync Questrade data",
        variant: "destructive",
      });
    } finally {
      setSyncing(false);
    }
  }

  function handleDisconnect() {
    openDialog(
      {
        title: "Disconnect Questrade",
        description: "Are you sure you want to disconnect your Questrade account? This will remove all Questrade connections.",
        variant: "destructive",
        confirmLabel: "Disconnect",
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
            title: "Account disconnected",
            description:
              "Your Questrade account has been disconnected successfully.",
            variant: "success",
          });

          await loadStatus();
          if (onDisconnect) {
            onDisconnect();
          }
        } catch (error: any) {
          console.error("Error disconnecting Questrade account:", error);
          toast({
            title: "Error",
            description: error.message || "Failed to disconnect Questrade account",
            variant: "destructive",
          });
        } finally {
          setDisconnecting(false);
        }
      }
    );
  }

  async function handleConnect() {
    if (!checkWriteAccess()) return;
    if (!manualAuthToken.trim()) {
      toast({
        title: "Error",
        description: "Please enter your Questrade authorization token",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsConnecting(true);

      const response = await fetch("/api/questrade/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          manualAuthToken: manualAuthToken.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to connect Questrade account");
      }

      toast({
        title: "Account connected",
        description:
          "Your Questrade account has been connected successfully. Your holdings and transactions are being synced.",
        variant: "success",
      });

      setShowConnectDialog(false);
      setManualAuthToken("");
      await loadStatus();

      if (onSuccess) {
        onSuccess();
      }
    } catch (error: any) {
      console.error("Error connecting Questrade account:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to connect Questrade account",
        variant: "destructive",
      });
    } finally {
      setIsConnecting(false);
    }
  }

  const hasQuestrade = questradeStatus?.isConnected || false;
  const integrations = [];

  if (hasQuestrade) {
    integrations.push({
      id: "questrade",
      name: "Questrade",
      connected: true,
    });
  }

  return (
    <FeatureGuard feature="hasInvestments" featureName="Investments">
      <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen}>
        <DropdownMenuTrigger asChild>
          <Button variant="outline">
            Integration
            <ChevronDown className="ml-2 h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>What's integrated</DropdownMenuLabel>
          <DropdownMenuSeparator />
          
          {integrations.length === 0 ? (
            <DropdownMenuItem disabled>
              No integrations connected
            </DropdownMenuItem>
          ) : (
            integrations.map((integration) => (
              <DropdownMenuSub key={integration.id}>
                <DropdownMenuSubTrigger>
                  {integration.name}
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  <DropdownMenuItem
                    onClick={handleSync}
                    disabled={syncing}
                  >
                    {syncing ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Syncing...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Sync
                      </>
                    )}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={handleDisconnect}
                    disabled={disconnecting}
                    className="text-red-600 focus:text-red-600 dark:text-red-400"
                  >
                    {disconnecting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Disconnecting...
                      </>
                    ) : (
                      <>
                        <Unlink className="mr-2 h-4 w-4" />
                        Disconnect
                      </>
                    )}
                  </DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            ))
          )}
          
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => {
              if (!checkWriteAccess()) return;
              setDropdownOpen(false);
              setShowConnectDialog(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add New
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      
      <Dialog open={showConnectDialog} onOpenChange={setShowConnectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Connect Questrade Account</DialogTitle>
            <DialogDescription>
              To connect your Questrade account, you need to generate an authorization token in the Questrade API Centre.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 px-6">
            <div className="space-y-2">
              <Label htmlFor="token">Authorization Token</Label>
              <Input
                id="token"
                type="text"
                placeholder="Enter your Questrade authorization token"
                value={manualAuthToken}
                onChange={(e) => setManualAuthToken(e.target.value)}
                disabled={isConnecting}
              />
              <p className="text-sm text-muted-foreground">
                Get your token at{" "}
                <a
                  href="https://www.questrade.com/api/documentation/getting-started"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline inline-flex items-center gap-1"
                >
                  Questrade API Centre
                  <ExternalLink className="h-3 w-3" />
                </a>
              </p>
            </div>
            <div className="rounded-lg bg-muted p-4 text-sm">
              <p className="font-semibold mb-2">How to get your token:</p>
              <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                <li>Log in to your Questrade account</li>
                <li>Go to API Centre in the top right menu</li>
                <li>Click "Activate API" and accept the terms</li>
                <li>Click "Register a personal app"</li>
                <li>Click "New manual authorization"</li>
                <li>Copy the authorization token and paste it here</li>
              </ol>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowConnectDialog(false)}
              disabled={isConnecting}
            >
              Cancel
            </Button>
            <Button onClick={handleConnect} disabled={isConnecting}>
              {isConnecting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Connecting...
                </>
              ) : (
                "Connect"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {ConfirmDialog}
    </FeatureGuard>
  );
}

