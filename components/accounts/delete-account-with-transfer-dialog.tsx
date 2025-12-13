"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Account {
  id: string;
  name: string;
  type: string;
}

interface DeleteAccountWithTransferDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accounts: Account[];
  accountToDelete: string | null;
  transferToAccountId: string;
  onTransferToAccountIdChange: (id: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

export function DeleteAccountWithTransferDialog({
  open,
  onOpenChange,
  accounts,
  accountToDelete,
  transferToAccountId,
  onTransferToAccountIdChange,
  onConfirm,
  onCancel,
}: DeleteAccountWithTransferDialogProps) {
  const availableAccounts = accounts.filter(
    (account) => account.id !== accountToDelete
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Account</DialogTitle>
          <DialogDescription>
            This account has associated transactions. Please select a destination
            account to transfer all transactions to before deleting.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4 px-6">
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Transfer transactions to:
            </label>
            <Select
              value={transferToAccountId}
              onValueChange={onTransferToAccountIdChange}
            >
              <SelectTrigger size="medium">
                <SelectValue placeholder="Select destination account" />
              </SelectTrigger>
              <SelectContent>
                {availableAccounts.map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    {account.name} ({account.type})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {availableAccounts.length === 0 && (
              <p className="text-sm text-muted-foreground">
                You need at least one other account to transfer transactions to.
                Please create another account first.
              </p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="medium" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            size="medium"
            onClick={() => {
              // Close dialog first, then call onConfirm
              onOpenChange(false);
              onConfirm();
            }}
            disabled={
              !transferToAccountId || availableAccounts.length === 0
            }
          >
            Delete and Transfer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

