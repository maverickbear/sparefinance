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
import { Loader2, AlertTriangle } from "lucide-react";
import type { AdminUser } from "@/lib/api/admin";

interface EndTrialOrCancelDialogProps {
  user: AdminUser | null;
  action: "end_trial" | "cancel" | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function EndTrialOrCancelDialog({
  user,
  action,
  open,
  onOpenChange,
  onSuccess,
}: EndTrialOrCancelDialogProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    if (!user || !user.subscription || !action) return;

    setError(null);
    setLoading(true);

    try {
      const response = await fetch("/api/admin/subscriptions/end-trial-or-cancel", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          subscriptionId: user.subscription.id,
          action,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to process request");
        setLoading(false);
        return;
      }

      if (data.warning) {
        // Show warning but still consider it a success
        console.warn("Warning:", data.warning);
      }

      onSuccess();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to process request");
    } finally {
      setLoading(false);
    }
  }

  if (!user || !user.subscription || !action) return null;

  const isEndTrial = action === "end_trial";
  const isCancel = action === "cancel";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            {isEndTrial ? "End Trial" : "Cancel Subscription"}
          </DialogTitle>
          <DialogDescription>
            {isEndTrial
              ? `Are you sure you want to end the trial for ${user.name || user.email}? This will immediately end their trial period.`
              : `Are you sure you want to cancel the subscription for ${user.name || user.email}? This will immediately cancel their subscription and they will lose access.`}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4 px-6">
          <div className="space-y-2">
            <div className="text-sm font-medium">User</div>
            <div className="text-sm text-muted-foreground">{user.name || user.email}</div>
          </div>
          <div className="space-y-2">
            <div className="text-sm font-medium">Plan</div>
            <div className="text-sm text-muted-foreground">{user.plan?.name || "-"}</div>
          </div>
          <div className="space-y-2">
            <div className="text-sm font-medium">Current Status</div>
            <div className="text-sm text-muted-foreground capitalize">{user.subscription.status}</div>
          </div>
          {isEndTrial && user.subscription.trialEndDate && (
            <div className="space-y-2">
              <div className="text-sm font-medium">Trial End Date</div>
              <div className="text-sm text-muted-foreground">
                {new Date(user.subscription.trialEndDate).toLocaleString()}
              </div>
            </div>
          )}
          {error && (
            <div className="text-sm text-destructive bg-destructive/10 p-2 rounded">
              {error}
            </div>
          )}
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
            variant="destructive"
            onClick={handleConfirm}
            disabled={loading}
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEndTrial ? "End Trial" : "Cancel Subscription"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

