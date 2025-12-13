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
import { DollarAmountInput } from "@/components/common/dollar-amount-input";
import { Loader2 } from "lucide-react";

interface Goal {
  id: string;
  name: string;
  currentBalance: number;
}

interface GoalTopUpDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  goal: Goal | null;
  onConfirm: (amount: number) => Promise<void>;
  loading?: boolean;
}

export function GoalTopUpDialog({
  open,
  onOpenChange,
  goal,
  onConfirm,
  loading = false,
}: GoalTopUpDialogProps) {
  const [amount, setAmount] = useState<number | undefined>(undefined);

  const handleSubmit = async () => {
    if (!goal || !amount || amount <= 0) {
      return;
    }

    await onConfirm(amount);
    setAmount(undefined);
  };

  const handleClose = () => {
    if (!loading) {
      setAmount(undefined);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Top-up</DialogTitle>
          <DialogDescription>
            Add money to {goal?.name || "this goal"}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 px-6 py-6">
          <div className="space-y-2">
            <label className="text-sm font-medium">Amount</label>
            <DollarAmountInput
              value={amount}
              onChange={setAmount}
              placeholder="$ 0.00"
              disabled={loading}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading || !amount || amount <= 0}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Adding...
              </>
            ) : (
              "Add Top-up"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

