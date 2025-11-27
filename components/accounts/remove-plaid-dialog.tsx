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
import { AlertTriangle, Loader2 } from "lucide-react";

interface Institution {
  id: string;
  name: string | null;
  logo: string | null;
  accountCount: number;
}

interface RemovePlaidDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void | Promise<void>;
  connectionCount: number;
  accountCount: number;
  institutions: Institution[];
  loading?: boolean;
}

export function RemovePlaidDialog({
  open,
  onOpenChange,
  onConfirm,
  connectionCount,
  accountCount,
  institutions,
  loading = false,
}: RemovePlaidDialogProps) {
  const handleConfirm = async () => {
    try {
      await onConfirm();
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
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <DialogTitle>Remove Plaid Integration</DialogTitle>
          </div>
          <DialogDescription>
            This will completely remove all Plaid connections and disconnect all bank accounts.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4 px-6">
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 space-y-2">
            <p className="text-sm font-medium text-destructive">
              Warning: This action cannot be undone
            </p>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
              <li>All {accountCount} connected bank account{accountCount !== 1 ? 's' : ''} will be disconnected</li>
              <li>All {connectionCount} Plaid connection{connectionCount !== 1 ? 's' : ''} will be removed</li>
              <li>You will need to reconnect from scratch if you want to use Plaid again</li>
              <li>Account data and transactions will remain, but automatic syncing will stop</li>
            </ul>
          </div>

          {institutions.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Connected Institutions:</p>
              <div className="space-y-2">
                {institutions.map((institution) => {
                  // Validate logo - must be a valid URL or data URL
                  const isValidLogo = institution.logo && (
                    institution.logo.startsWith('http://') ||
                    institution.logo.startsWith('https://') ||
                    institution.logo.startsWith('data:image/')
                  );
                  
                  return (
                    <div
                      key={institution.id}
                      className="flex items-center gap-2 p-2 rounded-lg border bg-muted/50"
                    >
                      {isValidLogo && (
                        <img
                          src={institution.logo!}
                          alt={institution.name || 'Institution'}
                          className="h-6 w-6 rounded object-contain"
                          onError={(e) => {
                            // Hide image on error
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      )}
                      <div className="flex-1">
                        <p className="text-sm font-medium">
                          {institution.name || 'Unknown Institution'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {institution.accountCount} account{institution.accountCount !== 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
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
            variant="destructive"
            onClick={handleConfirm}
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Removing...
              </>
            ) : (
              'Remove All'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

