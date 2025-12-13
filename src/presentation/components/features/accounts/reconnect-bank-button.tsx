"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { RotateCcw, Loader2 } from "lucide-react";
import { useToast } from "@/components/toast-provider";
import { PlaidLinkWrapper } from "./plaid-link-wrapper";
import { ReplaceManualAccountsDialog } from "./replace-manual-accounts-dialog";

interface ReconnectBankButtonProps {
  accountId: string;
  itemId?: string;
  onSuccess?: () => void;
}

export function ReconnectBankButton({
  accountId,
  itemId,
  onSuccess,
}: ReconnectBankButtonProps) {
  const { toast } = useToast();
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showReplaceDialog, setShowReplaceDialog] = useState(false);
  const [manualAccounts, setManualAccounts] = useState<Array<{ id: string; name: string; type: string }>>([]);
  const [newItemId, setNewItemId] = useState<string | null>(null);

  useEffect(() => {
    // Pre-fetch link token when component mounts
    fetchLinkToken();
  }, []);

  const fetchLinkToken = async () => {
    try {
      const response = await fetch("/api/v2/plaid/link/create-link-token", {
        method: "POST",
      });

      if (response.ok) {
        const data = await response.json();
        setLinkToken(data.linkToken);
      }
    } catch (error) {
      console.error("Error fetching link token:", error);
    }
  };

  const handleSuccess = async (publicToken: string, metadata: any) => {
    try {
      setLoading(true);

      // Exchange public token
      const response = await fetch("/api/v2/plaid/link/exchange-public-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publicToken }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to reconnect bank account");
      }

      // Check if there are manual accounts to replace
      if (data.manualAccountsDetected && data.manualAccountsDetected.length > 0) {
        setManualAccounts(data.manualAccountsDetected);
        setNewItemId(data.itemId);
        setShowReplaceDialog(true);
      } else {
        toast({
          title: "Bank reconnected",
          description: "Your bank account has been reconnected successfully.",
          variant: "success",
        });

        if (onSuccess) {
          onSuccess();
        }
      }
    } catch (error: any) {
      console.error("Error reconnecting bank:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to reconnect bank account",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleReplaceSuccess = () => {
    setShowReplaceDialog(false);
    toast({
      title: "Bank reconnected",
      description: "Your bank account has been reconnected and manual accounts have been replaced.",
      variant: "success",
    });

    if (onSuccess) {
      onSuccess();
    }
  };

  const handleOpenLink = async () => {
    if (!linkToken) {
      await fetchLinkToken();
      // Wait a bit for state to update
      await new Promise(resolve => setTimeout(resolve, 300));
    }
  };

  return (
    <>
      <PlaidLinkWrapper
        linkToken={linkToken}
        onSuccess={handleSuccess}
        onExit={(err) => {
          if (err) {
            // Error already handled in wrapper
          }
        }}
      >
        {({ open, ready, loading: linkLoading }) => (
          <Button
            variant="outline"
            size="medium"
            onClick={async () => {
              if (!linkToken) {
                await handleOpenLink();
                // Try again after token is fetched
                if (linkToken) {
                  open();
                } else {
                  toast({
                    title: "Error",
                    description: "Failed to initialize bank connection. Please try again.",
                    variant: "destructive",
                  });
                }
              } else {
                open();
              }
            }}
            disabled={loading || linkLoading || (!ready && !linkToken)}
          >
            {loading || linkLoading ? (
              <>
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                Connecting...
              </>
            ) : (
              <>
                <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                Reconnect Bank
              </>
            )}
          </Button>
        )}
      </PlaidLinkWrapper>

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
