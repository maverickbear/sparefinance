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
import { Input } from "@/components/ui/input";
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
  const [amount, setAmount] = useState<string>("");

  const handleSubmit = async () => {
    if (!goal) return;

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      return;
    }

    await onConfirm(amountNum);
    setAmount("");
  };

  const handleClose = () => {
    if (!loading) {
      setAmount("");
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
            <Input
              type="text"
              inputMode="decimal"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              disabled={loading}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading || !amount}>
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

