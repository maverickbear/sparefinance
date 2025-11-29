"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertCircle, Loader2, RefreshCw } from "lucide-react";

interface ReconnectAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onReconnect: () => void | Promise<void>;
  accountName?: string;
  institutionName?: string;
  loading?: boolean;
}

export function ReconnectAccountDialog({
  open,
  onOpenChange,
  onReconnect,
  accountName,
  institutionName,
  loading = false,
}: ReconnectAccountDialogProps) {
  const handleReconnect = async () => {
    try {
      await onReconnect();
    } catch (error) {
      // Error handling is done by the caller
      throw error;
    }
  };

  const handleCancel = () => {
    if (!loading) {
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleCancel}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-orange-500" />
            <DialogTitle>Reconnect Bank Account</DialogTitle>
          </div>
          <DialogDescription>
            Your bank connection needs to be updated to continue syncing transactions.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="rounded-lg border border-orange-500/50 bg-orange-500/10 p-4 space-y-3">
            <p className="text-sm font-medium text-foreground">
              Why do I need to reconnect?
            </p>
            <ul className="text-sm text-muted-foreground space-y-1.5 list-disc list-inside">
              <li>Your bank may have updated their security requirements</li>
              <li>Your login credentials may have expired</li>
              <li>Multi-factor authentication (MFA) may be required</li>
            </ul>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">What happens next?</p>
            <ol className="text-sm text-muted-foreground space-y-1.5 list-decimal list-inside">
              <li>We&apos;ll disconnect your current connection</li>
              <li>You&apos;ll be guided through reconnecting your account</li>
              <li>Your account data and transactions will be preserved</li>
              <li>Automatic syncing will resume once reconnected</li>
            </ol>
          </div>

          {(accountName || institutionName) && (
            <div className="rounded-lg border bg-muted/50 p-3">
              <p className="text-xs text-muted-foreground mb-1">Account to reconnect:</p>
              <p className="text-sm font-medium">
                {accountName || 'Unknown Account'}
                {institutionName && (
                  <span className="text-muted-foreground"> • {institutionName}</span>
                )}
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleReconnect}
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Reconnecting...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Reconnect Account
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

