"use client";

import { useState, useCallback, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { AccountForm } from "@/components/forms/account-form";
import { Wallet, Building2, Loader2 } from "lucide-react";
import { useToast } from "@/components/toast-provider";
import { usePlaidLinkContext } from "@/components/banking/plaid-link-context";
import { useSubscription } from "@/hooks/use-subscription";
import { ImportProgress } from "@/components/accounts/import-progress";

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
  const { limits, checking: limitsLoading } = useSubscription();
  const { initialize, open: openPlaid, ready, isInitialized } = usePlaidLinkContext();
  const [showManualForm, setShowManualForm] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [importJobIds, setImportJobIds] = useState<string[]>([]);

  const handleManualAccountSuccess = () => {
    setShowManualForm(false);
    onOpenChange(false);
    onSuccess?.();
    toast({
      title: "Account added",
      description: "Your account has been added successfully.",
      variant: "success",
    });
  };

  const onSuccessCallback = useCallback(
    async (publicToken: string, metadata: any) => {
      try {
        setIsConnecting(true);

        const response = await fetch('/api/plaid/exchange-public-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            publicToken,
            metadata,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to connect account');
        }

        setIsConnecting(false);

        // Check if there are import jobs (large imports)
        if (data.importJobs && data.importJobs.length > 0) {
          setImportJobIds(data.importJobs);
          toast({
            title: 'Bank account connected',
            description: 'Your account is connected. Importing transactions in the background...',
            variant: 'success',
          });
          // Don't close the sheet yet - show progress
        } else {
          // Small import completed immediately
          onOpenChange(false);
          onSuccess?.();
          toast({
            title: 'Bank account connected',
            description: 'Your bank account has been connected successfully.',
            variant: 'success',
          });
        }
      } catch (error: any) {
        setIsConnecting(false);
        toast({
          title: 'Error',
          description: error.message || 'Failed to connect account',
          variant: 'destructive',
        });
      }
    },
    [toast, onOpenChange, onSuccess]
  );

  const onErrorCallback = useCallback(
    (error: any, metadata: any) => {
      setIsConnecting(false);
      const errorCode = error?.error_code;
      const errorType = error?.error_type;

      if (errorCode === 'INTERNAL_SERVER_ERROR' || errorType === 'API_ERROR') {
        toast({
          title: 'Connection Error',
          description: 'An unexpected error occurred. Please try again in a few moments.',
          variant: 'destructive',
        });
      } else if (errorCode === 'INSTITUTION_NOT_RESPONDING' || errorCode === 'INSTITUTION_DOWN') {
        toast({
          title: 'Bank Temporarily Unavailable',
          description: 'Your bank is currently not responding. Please try again later.',
          variant: 'destructive',
        });
      } else if (errorCode === 'ITEM_LOGIN_REQUIRED') {
        toast({
          title: 'Login Required',
          description: 'Please reconnect your account. Your credentials may have expired.',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Connection Error',
          description: error?.display_message || error?.error_message || 'An error occurred while connecting.',
          variant: 'destructive',
        });
      }
    },
    [toast]
  );

  const handlePlaidExit = useCallback((err: any, metadata: any) => {
    setIsConnecting(false);
    setLinkToken(null);
  }, []);

  const handleConnectBank = useCallback(async () => {
    try {
      setIsConnecting(true);

      const response = await fetch('/api/plaid/create-link-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          accountType: 'bank',
          country: 'CA',
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 403 && data.planError) {
          toast({
            title: 'Upgrade Required',
            description: 'Bank integration is only available for paid plans.',
            variant: 'destructive',
          });
          setIsConnecting(false);
          return;
        }
        throw new Error(data.error || 'Failed to create link token');
      }

      setLinkToken(data.link_token);
      
      initialize({
        token: data.link_token,
        onSuccess: onSuccessCallback,
        onExit: (err, metadata) => {
          if (err) {
            onErrorCallback(err, metadata);
          }
          handlePlaidExit(err, metadata);
        },
      });
    } catch (error: any) {
      console.error('Error creating link token:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to connect account',
        variant: 'destructive',
      });
      setIsConnecting(false);
    }
  }, [initialize, onSuccessCallback, handlePlaidExit, toast]);

  // Open Plaid Link when token is ready
  useEffect(() => {
    if (linkToken && ready && openPlaid && isInitialized) {
      const timeout = setTimeout(() => {
        if (openPlaid) {
          openPlaid();
        }
      }, 100);
      return () => clearTimeout(timeout);
    }
  }, [linkToken, ready, openPlaid, isInitialized]);

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

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent 
        side="bottom" 
        className="max-h-[60vh] flex flex-col p-0"
      >
        {/* Drag Handle */}
        <div className="flex justify-center pt-3 pb-2 relative">
          <div className="w-12 h-1.5 bg-muted-foreground/30 rounded-full" />
        </div>

        <SheetHeader className="text-left pb-4 border-b px-6 flex-shrink-0">
          <SheetTitle>Add Account</SheetTitle>
        </SheetHeader>

        <div className="px-6 py-6 space-y-3 overflow-y-auto flex-1">
          {importJobIds.length > 0 && (
            <ImportProgress
              jobIds={importJobIds}
              onComplete={() => {
                setImportJobIds([]);
                onOpenChange(false);
                onSuccess?.();
              }}
            />
          )}

          <Button
            variant="outline"
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

          <Button
            variant="outline"
            className="w-full h-auto p-4 flex items-center gap-3"
            onClick={handleConnectBank}
            disabled={isConnecting || limitsLoading || !limits.hasBankIntegration}
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
            {isConnecting && (
              <Loader2 className="h-4 w-4 animate-spin" />
            )}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

