"use client";

import { useState, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AccountForm } from "@/components/forms/account-form";
import { Wallet, Building2, Loader2 } from "lucide-react";
import { useToast } from "@/components/toast-provider";
import { useBreakpoint } from "@/hooks/use-breakpoint";
import { cn } from "@/lib/utils";
import { PlaidLinkWrapper } from "./plaid-link-wrapper";
import { ReplaceManualAccountsDialog } from "./replace-manual-accounts-dialog";
import { PlaidImportLoadingModal } from "./plaid-import-loading-modal";

interface AddAccountSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  canWrite?: boolean;
}

export function AddAccountSheet({
  open,
  onOpenChange,
  onSuccess,
  canWrite = true,
}: AddAccountSheetProps) {
  const { toast } = useToast();
  const breakpoint = useBreakpoint();
  const isDesktop = breakpoint === "lg" || breakpoint === "xl" || breakpoint === "2xl";
  const [showManualForm, setShowManualForm] = useState(false);
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showReplaceDialog, setShowReplaceDialog] = useState(false);
  const [manualAccounts, setManualAccounts] = useState<Array<{ id: string; name: string; type: string }>>([]);
  const [newItemId, setNewItemId] = useState<string | null>(null);
  const [tokenFetched, setTokenFetched] = useState(false);
  const [plaidLinkOpen, setPlaidLinkOpen] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importStage, setImportStage] = useState<"exchanging" | "syncing" | "complete">("exchanging");
  const [importInstitutionName, setImportInstitutionName] = useState<string>("");
  const [importAccountCount, setImportAccountCount] = useState<number>(0);

  useEffect(() => {
    // Fetch link token when sheet opens
    if (open && !linkToken) {
      console.log('[AddAccountSheet] Sheet opened, fetching link token...');
      fetchLinkToken();
    }
  }, [open]);

  const fetchLinkToken = async () => {
    try {
      console.log('[AddAccountSheet] Fetching link token...');
      const response = await fetch("/api/v2/plaid/link/create-link-token", {
        method: "POST",
      });

      if (response.ok) {
        const data = await response.json();
        console.log('[AddAccountSheet] Link token received:', data.linkToken ? 'Token received' : 'No token');
        if (data.linkToken) {
          setLinkToken(data.linkToken);
          setTokenFetched(true);
        } else {
          console.error('[AddAccountSheet] No linkToken in response:', data);
        }
      } else {
        // If Plaid is disabled or not configured, that's okay - manual option is still available
        const errorData = await response.json().catch(() => ({}));
        console.error('[AddAccountSheet] Error fetching link token:', response.status, errorData);
        if (response.status === 503) {
          // Plaid is disabled, which is fine - we'll just show manual option
          console.log("Plaid integration is disabled");
        }
      }
    } catch (error) {
      console.error('[AddAccountSheet] Exception fetching link token:', error);
      // Don't show error to user - manual option is still available
    }
  };

  const handleManualAccountSuccess = () => {
    setShowManualForm(false);
    onOpenChange(false);
    // Dispatch custom event to notify other components (e.g., OnboardingWidget)
    window.dispatchEvent(new CustomEvent("account-created"));
    onSuccess?.();
    toast({
      title: "Account added",
      description: "Your account has been added successfully.",
      variant: "success",
    });
  };

  const handlePlaidSuccess = async (publicToken: string, metadata: any) => {
    // Extract institution name from metadata
    const institutionName = metadata?.institution?.name || 
                           metadata?.institutionName || 
                           'Connecting bank account...';
    
    try {
      setLoading(true);
      // Reset Plaid Link state since we're processing the success
      setPlaidLinkOpen(false);

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
        // Don't close dialog yet - show replace dialog instead
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
          
          // Wait for modal to show completion, then close
          setTimeout(() => {
            setShowImportModal(false);
            toast({
              title: "Bank connected",
              description: `Successfully connected ${accountCount} account(s) and imported ${syncData.transactionsCreated || 0} transaction(s).`,
              variant: "success",
            });
            // Dispatch custom event
            window.dispatchEvent(new CustomEvent("account-created"));
            onOpenChange(false);
            onSuccess?.();
          }, 1500);
        } else {
          // Sync failed, but accounts were created
          const syncError = await syncResponse.json().catch(() => ({ error: "Unknown error" }));
          setShowImportModal(false);
          toast({
            title: "Bank connected",
            description: `Successfully connected ${accountCount} account(s). Transaction sync failed: ${syncError.error || "Unknown error"}. You can sync manually later.`,
            variant: "success",
          });
          // Dispatch custom event
          window.dispatchEvent(new CustomEvent("account-created"));
          onOpenChange(false);
          onSuccess?.();
        }
      } catch (syncError) {
        // Sync error, but accounts were created
        console.error("Error syncing transactions:", syncError);
        setShowImportModal(false);
        toast({
          title: "Bank connected",
          description: `Successfully connected ${accountCount} account(s). Transaction sync encountered an error. You can sync manually later.`,
          variant: "success",
        });
        // Dispatch custom event
        window.dispatchEvent(new CustomEvent("account-created"));
        onOpenChange(false);
        onSuccess?.();
      }
    } catch (error: unknown) {
      console.error("Error connecting bank:", error);
      // Reset Plaid Link state on error
      setPlaidLinkOpen(false);
      setShowImportModal(false);
      const errorMessage = error instanceof Error ? error.message : "Failed to connect bank account";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
      // Keep dialog open so user can try again or use manual option
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

    // Dispatch custom event
    window.dispatchEvent(new CustomEvent("account-created"));
    onOpenChange(false);
    onSuccess?.();
  };

  if (showManualForm) {
    return (
      <AccountForm
        open={open}
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            setShowManualForm(false);
          }
          onOpenChange(isOpen);
        }}
        onSuccess={handleManualAccountSuccess}
      />
    );
  }

  const content = (
    <div className="space-y-3">
      {/* Plaid Link Option */}
      <PlaidLinkWrapper
        linkToken={linkToken}
        onSuccess={handlePlaidSuccess}
        onExit={(err, metadata) => {
          console.log('[AddAccountSheet] Plaid Link exited', { err, metadata });
          // Reset Plaid Link state
          setPlaidLinkOpen(false);
          // Only close dialog if Plaid Link actually exited (not just opened)
          // The onSuccess callback will handle closing when connection succeeds
          // If there's an error, we should also close
          if (err) {
            // Error already handled in wrapper, close dialog
            onOpenChange(false);
          }
          // If no error, onSuccess will handle closing
        }}
      >
        {({ open, ready, loading: linkLoading }) => {
          const handleClick = async () => {
            console.log('[AddAccountSheet] Button clicked', { 
              hasLinkToken: !!linkToken, 
              ready, 
              linkLoading,
              canWrite 
            });
            
            // If no linkToken, try to fetch it first
            if (!linkToken) {
              console.log('[AddAccountSheet] No linkToken, fetching...');
              setLoading(true);
              try {
                await fetchLinkToken();
                // Wait a moment for state to update and Plaid Link to initialize
                await new Promise(resolve => setTimeout(resolve, 500));
              } finally {
                setLoading(false);
              }
              
              // After fetch, check if we got the token
              // The component will re-render, so we'll try again on next click if needed
              if (!linkToken) {
                toast({
                  title: "Loading...",
                  description: "Please wait while we initialize the connection...",
                  variant: "default",
                });
              }
              return;
            }
            
            // If we have linkToken but not ready, wait a bit and try again
            if (linkToken && !ready) {
              console.log('[AddAccountSheet] Link token exists but not ready yet, waiting...');
              // Wait up to 2 seconds for ready state
              for (let i = 0; i < 10; i++) {
                await new Promise(resolve => setTimeout(resolve, 200));
                // Check if ready now (the ready state will update in the hook)
                // We can't directly check it, but the component will re-render
              }
              
              // Try to open anyway - if still not ready, the open() call will handle it
              if (ready) {
                console.log('[AddAccountSheet] Ready now, opening...');
                try {
                  // Mark Plaid Link as open (don't close dialog yet)
                  setPlaidLinkOpen(true);
                  // Open Plaid Link (it will create its own modal overlay)
                  open();
                  // Hide our dialog but keep it mounted (so Plaid Link doesn't unmount)
                  // We'll close it properly in the onExit callback
                } catch (error: any) {
                  console.error('[AddAccountSheet] Error opening Plaid Link:', error);
                  setPlaidLinkOpen(false);
                  toast({
                    title: "Error",
                    description: error?.message || "Failed to open bank connection. Please try again.",
                    variant: "destructive",
                  });
                }
              } else {
                toast({
                  title: "Almost ready",
                  description: "Please wait a moment and try again...",
                  variant: "default",
                });
              }
              return;
            }
            
            // Try to open - we have token and ready
            if (linkToken && ready) {
              console.log('[AddAccountSheet] Opening Plaid Link');
              try {
                // Mark Plaid Link as open BEFORE opening (prevents dialog from closing)
                setPlaidLinkOpen(true);
                // Open Plaid Link (it creates its own modal overlay)
                open();
                // Hide our dialog visually but keep it mounted (so Plaid Link doesn't unmount)
                // We'll close it properly in the onExit callback
              } catch (error: any) {
                console.error('[AddAccountSheet] Error opening Plaid Link:', error);
                setPlaidLinkOpen(false);
                toast({
                  title: "Error",
                  description: error?.message || "Failed to open bank connection. Please try again.",
                  variant: "destructive",
                });
              }
            } else {
              console.error('[AddAccountSheet] Cannot open: missing token or not ready');
              toast({
                title: "Not ready",
                description: "Please wait while we initialize the connection...",
                variant: "default",
              });
            }
          };
          
          // Only disable if we don't have write access or are actively processing
          // Allow clicking to trigger token fetch or wait for ready state
          const isDisabled = !canWrite || (loading && tokenFetched) || (linkLoading && tokenFetched);
          const isInitializing = !linkToken || (!ready && tokenFetched);
          
          return (
            <Button
              variant="outline"
              size="medium"
              className={cn(
                "w-full h-auto p-4 flex items-center gap-3",
                isInitializing && "opacity-75 cursor-wait"
              )}
              onClick={handleClick}
              disabled={isDisabled}
            >
            <div className="p-2 rounded-lg bg-muted">
              <Building2 className="h-5 w-5" />
            </div>
            <div className="flex-1 text-left">
              <div className="font-semibold">Connect Bank Account</div>
              <div className="text-sm text-muted-foreground">
                Securely connect via Plaid
              </div>
            </div>
            {(loading || linkLoading) && (
              <Loader2 className="h-4 w-4 animate-spin" />
            )}
            {isInitializing && !loading && !linkLoading && (
              <span className="text-xs text-muted-foreground ml-2">Initializing...</span>
            )}
          </Button>
          );
        }}
      </PlaidLinkWrapper>

      {/* Manual Account Option */}
      <Button
        variant="outline"
        size="medium"
        className="w-full h-auto p-4 flex items-center gap-3"
        onClick={() => setShowManualForm(true)}
        disabled={!canWrite}
      >
        <div className="p-2 rounded-lg bg-muted">
          <Wallet className="h-5 w-5" />
        </div>
        <div className="flex-1 text-left">
          <div className="font-semibold">Add Bank Account</div>
          <div className="text-sm text-muted-foreground">
            Manually add an account
          </div>
        </div>
      </Button>
    </div>
  );

  return (
    <>
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

      {/* Render main sheet/dialog */}
      {isDesktop ? (
        <Dialog 
          open={open} 
          onOpenChange={(isOpen) => {
            // Don't allow closing if Plaid Link is open
            if (!isOpen && plaidLinkOpen) {
              return;
            }
            onOpenChange(isOpen);
          }}
        >
          <DialogContent 
            className="max-w-md"
            // Hide dialog visually when Plaid Link is open, but keep it mounted
            style={{ display: plaidLinkOpen ? 'none' : undefined }}
          >
            <DialogHeader>
              <DialogTitle>Add Account</DialogTitle>
            </DialogHeader>
            <div className="px-6 py-6 space-y-3">
              {content}
            </div>
          </DialogContent>
        </Dialog>
      ) : (
        <Sheet 
          open={open} 
          onOpenChange={(isOpen) => {
            // Don't allow closing if Plaid Link is open
            if (!isOpen && plaidLinkOpen) {
              return;
            }
            onOpenChange(isOpen);
          }}
        >
          <SheetContent 
            side="bottom" 
            className="max-h-[60vh] flex flex-col p-0"
            // Hide sheet visually when Plaid Link is open, but keep it mounted
            style={{ display: plaidLinkOpen ? 'none' : undefined }}
          >
            {/* Drag Handle */}
            <div className="flex justify-center pt-3 pb-2 relative">
              <div className="w-12 h-1.5 bg-muted-foreground/30 rounded-full" />
            </div>

            <SheetHeader className="text-left pb-4 border-b px-6 flex-shrink-0">
              <SheetTitle>Add Account</SheetTitle>
            </SheetHeader>

            <div className="px-6 py-6 space-y-3 overflow-y-auto flex-1">
              {content}
            </div>
          </SheetContent>
        </Sheet>
      )}
    </>
  );
}

