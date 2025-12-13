"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AccountForm } from "@/components/forms/account-form";
import { PlaidLinkWrapper } from "./plaid-link-wrapper";
import { ReplaceManualAccountsDialog } from "./replace-manual-accounts-dialog";
import { PlaidImportLoadingModal } from "./plaid-import-loading-modal";
import { Wallet, Building2, ChevronDown, Plus } from "lucide-react";
import { useToast } from "@/components/toast-provider";

// Internal component that opens Plaid Link when ready
function PlaidLinkAutoOpener({ open, ready }: { open: () => void; ready: boolean }) {
  const hasOpenedRef = useRef(false);

  useEffect(() => {
    if (ready && !hasOpenedRef.current) {
      hasOpenedRef.current = true;
      // Small delay to ensure Plaid Link is fully initialized
      const timer = setTimeout(() => {
        try {
          open();
        } catch (error) {
          console.error('[PlaidLinkAutoOpener] Error opening Plaid Link:', error);
          hasOpenedRef.current = false;
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [ready, open]);

  return null;
}

// Internal component to handle Plaid Link opening
function PlaidLinkOpener({
  linkToken,
  onSuccess,
  onExit,
}: {
  linkToken: string;
  onSuccess: (publicToken: string, metadata: any) => Promise<void>;
  onExit?: (err: any, metadata: any) => void;
}) {
  return (
    <PlaidLinkWrapper
      linkToken={linkToken}
      onSuccess={onSuccess}
      onExit={onExit}
    >
      {({ open, ready }) => (
        <PlaidLinkAutoOpener open={open} ready={ready} />
      )}
    </PlaidLinkWrapper>
  );
}

interface AddAccountDropdownProps {
  onSuccess?: () => void;
  canWrite?: boolean;
  trigger?: React.ReactNode;
}

export function AddAccountDropdown({
  onSuccess,
  canWrite = true,
  trigger,
}: AddAccountDropdownProps) {
  const { toast } = useToast();
  const [showManualForm, setShowManualForm] = useState(false);
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showReplaceDialog, setShowReplaceDialog] = useState(false);
  const [manualAccounts, setManualAccounts] = useState<Array<{ id: string; name: string; type: string }>>([]);
  const [newItemId, setNewItemId] = useState<string | null>(null);
  const [plaidLinkOpen, setPlaidLinkOpen] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importStage, setImportStage] = useState<"exchanging" | "syncing" | "complete">("exchanging");
  const [importInstitutionName, setImportInstitutionName] = useState<string>("");
  const [importAccountCount, setImportAccountCount] = useState<number>(0);

  // Fetch link token when component mounts
  useEffect(() => {
    if (!linkToken) {
      fetchLinkToken();
    }
  }, []);

  // Open Plaid Link when token becomes available after user clicked "Connect Bank Account"
  useEffect(() => {
    if (plaidLinkOpen && linkToken) {
      // Token is available, PlaidLinkOpener will handle opening
      // This effect ensures that if the user clicked before token was ready,
      // we open it once the token is available
    }
  }, [plaidLinkOpen, linkToken]);

  const fetchLinkToken = async () => {
    try {
      const response = await fetch("/api/v2/plaid/link/create-link-token", {
        method: "POST",
      });

      if (response.ok) {
        const data = await response.json();
        if (data.linkToken) {
          setLinkToken(data.linkToken);
        }
      } else {
        // If Plaid is disabled or not configured, that's okay
        const errorData = await response.json().catch(() => ({}));
        if (response.status === 503) {
          console.log("Plaid integration is disabled");
        }
      }
    } catch (error) {
      console.error('[AddAccountDropdown] Exception fetching link token:', error);
    }
  };

  const handleManualAccountSuccess = () => {
    setShowManualForm(false);
    window.dispatchEvent(new CustomEvent("account-created"));
    onSuccess?.();
    toast({
      title: "Account added",
      description: "Your account has been added successfully.",
      variant: "success",
    });
  };

  // Helper functions for localStorage management
  const cleanupOldPendingConnections = () => {
    try {
      const pending = JSON.parse(localStorage.getItem('plaid-pending-connections') || '[]');
      const now = Date.now();
      const fiveMinutes = 5 * 60 * 1000;
      const validPending = pending.filter((conn: any) => {
        return (now - conn.timestamp) < fiveMinutes;
      });
      if (validPending.length !== pending.length) {
        localStorage.setItem('plaid-pending-connections', JSON.stringify(validPending));
      }
      return validPending;
    } catch (error) {
      console.error('[AddAccountDropdown] Error cleaning up pending connections:', error);
      return [];
    }
  };

  const savePendingConnection = (institutionName: string) => {
    try {
      // Clean up old entries first
      const validPending = cleanupOldPendingConnections();
      const newConnection = {
        institutionName,
        timestamp: Date.now(),
        status: 'connecting' as const,
      };
      validPending.push(newConnection);
      localStorage.setItem('plaid-pending-connections', JSON.stringify(validPending));
    } catch (error) {
      console.error('[AddAccountDropdown] Error saving pending connection:', error);
    }
  };

  const removePendingConnection = (institutionName: string) => {
    try {
      const pending = JSON.parse(localStorage.getItem('plaid-pending-connections') || '[]');
      const filtered = pending.filter((conn: any) => conn.institutionName !== institutionName);
      localStorage.setItem('plaid-pending-connections', JSON.stringify(filtered));
    } catch (error) {
      console.error('[AddAccountDropdown] Error removing pending connection:', error);
    }
  };

  const handlePlaidSuccess = async (publicToken: string, metadata: any) => {
    // Extract institution name from metadata
    const institutionName = metadata?.institution?.name || 
                           metadata?.institutionName || 
                           'Connecting bank account...';
    
    try {
      setLoading(true);
      setPlaidLinkOpen(false);

      // Save pending connection to localStorage before exchange
      savePendingConnection(institutionName);

      // Show import modal
      setImportInstitutionName(institutionName);
      setImportStage("exchanging");
      setShowImportModal(true);

      // Step 1: Exchange public token
      const response = await fetch("/api/v2/plaid/link/exchange-public-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publicToken }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Remove pending connection on error
        removePendingConnection(institutionName);
        setShowImportModal(false);
        throw new Error(data.error || "Failed to connect bank account");
      }

      const accountCount = data.createdAccounts?.length || 0;
      setImportAccountCount(accountCount);

      // Check if there are manual accounts to replace
      if (data.manualAccountsDetected && data.manualAccountsDetected.length > 0) {
        // Close import modal and show replace dialog
        setShowImportModal(false);
        setManualAccounts(data.manualAccountsDetected);
        setNewItemId(data.itemId);
        setShowReplaceDialog(true);
        // Remove pending connection after successful exchange
        removePendingConnection(institutionName);
        return;
      }

      // Step 2: Sync transactions
      setImportStage("syncing");
      
      try {
        const syncResponse = await fetch("/api/v2/plaid/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ itemId: data.itemId }),
        });

        if (syncResponse.ok) {
          const syncData = await syncResponse.json();
          // Sync completed successfully
          setImportStage("complete");
          
          // Remove pending connection after successful sync
          removePendingConnection(institutionName);
          
          // Wait for modal to show completion, then close
          setTimeout(() => {
            setShowImportModal(false);
            toast({
              title: "Bank connected",
              description: `Successfully connected ${accountCount} account(s) and imported ${syncData.transactionsCreated || 0} transaction(s).`,
              variant: "success",
            });
            window.dispatchEvent(new CustomEvent("account-created"));
            onSuccess?.();
          }, 1500);
        } else {
          // Sync failed, but accounts were created
          const syncError = await syncResponse.json().catch(() => ({ error: "Unknown error" }));
          setShowImportModal(false);
          removePendingConnection(institutionName);
          toast({
            title: "Bank connected",
            description: `Successfully connected ${accountCount} account(s). Transaction sync failed: ${syncError.error || "Unknown error"}. You can sync manually later.`,
            variant: "success",
          });
          window.dispatchEvent(new CustomEvent("account-created"));
          onSuccess?.();
        }
      } catch (syncError) {
        // Sync error, but accounts were created
        console.error("Error syncing transactions:", syncError);
        setShowImportModal(false);
        removePendingConnection(institutionName);
        toast({
          title: "Bank connected",
          description: `Successfully connected ${accountCount} account(s). Transaction sync encountered an error. You can sync manually later.`,
          variant: "success",
        });
        window.dispatchEvent(new CustomEvent("account-created"));
        onSuccess?.();
      }
    } catch (error: unknown) {
      console.error("Error connecting bank:", error);
      setPlaidLinkOpen(false);
      setShowImportModal(false);
      // Ensure pending connection is removed on error
      removePendingConnection(institutionName);
      const errorMessage = error instanceof Error ? error.message : "Failed to connect bank account";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleReplaceSuccess = () => {
    setShowReplaceDialog(false);
    toast({
      title: "Bank connected",
      description: "Your bank account has been connected and manual accounts have been replaced.",
      variant: "success",
    });

    window.dispatchEvent(new CustomEvent("account-created"));
    onSuccess?.();
    // Note: Pending connection was already removed in handlePlaidSuccess
  };

  const handleConnectBankAccount = async () => {
    if (!linkToken) {
      toast({
        title: "Loading...",
        description: "Please wait while we initialize the connection...",
        variant: "default",
      });
      await fetchLinkToken();
      // Wait a bit for the token to be set and Plaid Link to initialize
      // Use a small delay to allow state to update
      setTimeout(() => {
        setPlaidLinkOpen(true);
      }, 300);
      return;
    }
    setPlaidLinkOpen(true);
  };

  const defaultTrigger = (
    <Button variant="outline" size="medium" disabled={!canWrite}>
      <Plus className="h-3 w-3 mr-1.5" />
      Connect or Add Account
      <ChevronDown className="h-3 w-3 ml-1.5" />
    </Button>
  );

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          {trigger || defaultTrigger}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem
            onClick={() => setShowManualForm(true)}
            disabled={!canWrite}
          >
            <Wallet className="h-4 w-4 mr-2" />
            Add Manually
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={handleConnectBankAccount}
            disabled={!canWrite || loading}
          >
            <Building2 className="h-4 w-4 mr-2" />
            Connect Bank Account
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Manual Account Form */}
      {showManualForm && (
        <AccountForm
          open={showManualForm}
          onOpenChange={(isOpen) => {
            if (!isOpen) {
              setShowManualForm(false);
            }
          }}
          onSuccess={handleManualAccountSuccess}
        />
      )}

      {/* Plaid Link */}
      {plaidLinkOpen && linkToken && (
        <PlaidLinkOpener
          linkToken={linkToken}
          onSuccess={handlePlaidSuccess}
          onExit={(err, metadata) => {
            console.log('[AddAccountDropdown] Plaid Link exited', { err, metadata });
            setPlaidLinkOpen(false);
            if (err) {
              // If user cancelled or there was an error, remove any pending connection
              const institutionName = metadata?.institution?.name || 
                                     metadata?.institutionName || 
                                     null;
              if (institutionName) {
                removePendingConnection(institutionName);
              }
              // Error already handled in wrapper
            }
          }}
        />
      )}

      {/* Import Loading Modal */}
      <PlaidImportLoadingModal
        open={showImportModal}
        institutionName={importInstitutionName}
        accountCount={importAccountCount}
        stage={importStage}
        onComplete={() => {
          setShowImportModal(false);
        }}
      />

      {/* Replace Manual Accounts Dialog */}
      {showReplaceDialog && newItemId && (
        <ReplaceManualAccountsDialog
          open={showReplaceDialog}
          onOpenChange={setShowReplaceDialog}
          itemId={newItemId}
          manualAccounts={manualAccounts}
          onSuccess={handleReplaceSuccess}
        />
      )}
    </>
  );
}

