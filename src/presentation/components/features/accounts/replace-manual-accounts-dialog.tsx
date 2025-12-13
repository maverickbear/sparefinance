"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/toast-provider";
import { Loader2, AlertTriangle } from "lucide-react";

interface ManualAccount {
  id: string;
  name: string;
  type: string;
}

interface ReplaceManualAccountsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemId: string;
  manualAccounts: ManualAccount[];
  onSuccess?: () => void;
}

export function ReplaceManualAccountsDialog({
  open,
  onOpenChange,
  itemId,
  manualAccounts,
  onSuccess,
}: ReplaceManualAccountsDialogProps) {
  const { toast } = useToast();
  const [selectedAccountIds, setSelectedAccountIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  const handleToggleAccount = (accountId: string) => {
    setSelectedAccountIds((prev) => {
      const next = new Set(prev);
      if (next.has(accountId)) {
        next.delete(accountId);
      } else {
        next.add(accountId);
      }
      return next;
    });
  };

  const handleReplace = async () => {
    if (selectedAccountIds.size === 0) {
      toast({
        title: "No accounts selected",
        description: "Please select at least one account to replace.",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`/api/v2/plaid/items/${itemId}/replace-manual-accounts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          manualAccountIds: Array.from(selectedAccountIds),
        }),
      });

      const data = await response.json();

      if (response.ok) {
        toast({
          title: "Accounts replaced",
          description: `Successfully replaced ${data.results?.filter((r: any) => r.success).length || 0} account(s).`,
          variant: "success",
        });
        onOpenChange(false);
        setSelectedAccountIds(new Set());
        if (onSuccess) {
          onSuccess();
        }
      } else {
        throw new Error(data.error || "Failed to replace accounts");
      }
    } catch (error: any) {
      console.error("Error replacing accounts:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to replace accounts",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Replace Manual Accounts</DialogTitle>
          <DialogDescription>
            We found manual accounts from the same bank. Would you like to replace them with the connected Plaid accounts?
            All transactions will be transferred to the new accounts.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-4">
          <div className="rounded-md bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 p-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-yellow-800 dark:text-yellow-300">
                  Important
                </p>
                <p className="text-xs text-yellow-700 dark:text-yellow-400 mt-1">
                  Replacing accounts will transfer all transactions to the new Plaid-connected accounts and delete the manual accounts.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">Select accounts to replace:</Label>
            {manualAccounts.map((account) => (
              <div key={account.id} className="flex items-center space-x-2 p-2 rounded-md border hover:bg-muted/50">
                <Checkbox
                  id={account.id}
                  checked={selectedAccountIds.has(account.id)}
                  onCheckedChange={() => handleToggleAccount(account.id)}
                />
                <Label
                  htmlFor={account.id}
                  className="flex-1 cursor-pointer text-sm font-normal"
                >
                  <div className="font-medium">{account.name}</div>
                  <div className="text-xs text-muted-foreground capitalize">{account.type}</div>
                </Label>
              </div>
            ))}
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleReplace}
            disabled={loading || selectedAccountIds.size === 0}
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Replacing...
              </>
            ) : (
              `Replace ${selectedAccountIds.size} Account${selectedAccountIds.size !== 1 ? 's' : ''}`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
