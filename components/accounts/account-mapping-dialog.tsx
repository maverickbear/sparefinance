"use client";

import { useState } from 'react';
import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/components/toast-provider';

interface AccountPreview {
  accountId: string;
  name: string;
  plaidType: string;
  plaidSubtype: string | null;
  suggestedType: 'checking' | 'savings' | 'credit' | 'investment' | 'other';
  balance: number;
  currencyCode: string;
  mask: string | null;
  officialName: string | null;
}

interface AccountMappingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accounts: AccountPreview[];
  institutionName: string;
  onConfirm: (accountMappings: Record<string, 'checking' | 'savings' | 'credit' | 'investment' | 'other'>) => Promise<void>;
}

export function AccountMappingDialog({
  open,
  onOpenChange,
  accounts,
  institutionName,
  onConfirm,
}: AccountMappingDialogProps) {
  const [accountTypes, setAccountTypes] = useState<Record<string, 'checking' | 'savings' | 'credit' | 'investment' | 'other'>>(() => {
    const initial: Record<string, 'checking' | 'savings' | 'credit' | 'investment' | 'other'> = {};
    accounts.forEach((account) => {
      initial[account.accountId] = account.suggestedType;
    });
    return initial;
  });
  const [isConfirming, setIsConfirming] = useState(false);
  const { toast } = useToast();

  // Reset state when dialog closes or accounts change
  React.useEffect(() => {
    if (!open) {
      // Reset to suggested types when dialog closes
      const initial: Record<string, 'checking' | 'savings' | 'credit' | 'investment' | 'other'> = {};
      accounts.forEach((account) => {
        initial[account.accountId] = account.suggestedType;
      });
      setAccountTypes(initial);
      setIsConfirming(false);
    }
  }, [open, accounts]);

  const handleConfirm = async () => {
    // Validate that all accounts have a type selected
    const missingTypes = accounts.filter(account => !accountTypes[account.accountId]);
    if (missingTypes.length > 0) {
      toast({
        title: 'Validation Error',
        description: `Please select a type for all accounts. ${missingTypes.length} account(s) missing type.`,
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsConfirming(true);
      await onConfirm(accountTypes);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to import accounts',
        variant: 'destructive',
      });
      // Don't set isConfirming to false here - let the parent handle it
      // This allows the dialog to stay open so user can retry
    } finally {
      setIsConfirming(false);
    }
  };

  const formatBalance = (balance: number, currencyCode: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currencyCode || 'USD',
    }).format(balance);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Confirm Account Import</DialogTitle>
          <DialogDescription>
            Review and confirm the account types for {institutionName}. You can adjust the account type if needed.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {accounts.map((account) => (
            <div
              key={account.accountId}
              className="flex items-start gap-4 p-4 border rounded-lg"
            >
              <div className="flex-1 space-y-2">
                <div>
                  <div className="font-medium">{account.name}</div>
                  {account.officialName && account.officialName !== account.name && (
                    <div className="text-sm text-muted-foreground">{account.officialName}</div>
                  )}
                  {account.mask && (
                    <div className="text-xs text-muted-foreground">•••• {account.mask}</div>
                  )}
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Balance: </span>
                    <span className="font-medium">{formatBalance(account.balance, account.currencyCode)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Plaid Type: </span>
                    <span className="font-medium">{account.plaidType}</span>
                    {account.plaidSubtype && (
                      <span className="text-muted-foreground"> ({account.plaidSubtype})</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="w-48">
                <Label htmlFor={`type-${account.accountId}`} className="text-xs mb-1 block">
                  Account Type
                </Label>
                <Select
                  value={accountTypes[account.accountId]}
                  onValueChange={(value: 'checking' | 'savings' | 'credit' | 'investment' | 'other') => {
                    setAccountTypes((prev) => ({
                      ...prev,
                      [account.accountId]: value,
                    }));
                  }}
                >
                  <SelectTrigger id={`type-${account.accountId}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="checking">Checking</SelectItem>
                    <SelectItem value="savings">Savings</SelectItem>
                    <SelectItem value="credit">Credit Card</SelectItem>
                    <SelectItem value="investment">Investment</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isConfirming}
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isConfirming}
          >
            {isConfirming ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Importing...
              </>
            ) : (
              'Confirm & Import'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

