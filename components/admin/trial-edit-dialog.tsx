"use client";

import { useState, useEffect } from "react";
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
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { format } from "date-fns";
import type { AdminUser } from "@/lib/api/admin";

interface TrialEditDialogProps {
  user: AdminUser | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function TrialEditDialog({
  user,
  open,
  onOpenChange,
  onSuccess,
}: TrialEditDialogProps) {
  const [trialEndDate, setTrialEndDate] = useState("");
  const [trialEndTime, setTrialEndTime] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user && user.subscription && user.subscription.trialEndDate) {
      const date = new Date(user.subscription.trialEndDate);
      setTrialEndDate(format(date, "yyyy-MM-dd"));
      setTrialEndTime(format(date, "HH:mm"));
    } else {
      // Default to tomorrow if no trial end date
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      setTrialEndDate(format(tomorrow, "yyyy-MM-dd"));
      setTrialEndTime("23:59");
    }
    setError(null);
  }, [user, open]);

  async function handleSave() {
    if (!user || !user.subscription || !user.subscription.id) return;

    setError(null);
    setLoading(true);

    try {
      // Combine date and time
      const dateTimeString = `${trialEndDate}T${trialEndTime}:00`;
      const trialEnd = new Date(dateTimeString);

      // Validate
      if (isNaN(trialEnd.getTime())) {
        setError("Invalid date/time format");
        setLoading(false);
        return;
      }

      const now = new Date();
      if (trialEnd <= now) {
        setError("Trial end date must be in the future");
        setLoading(false);
        return;
      }

      const response = await fetch("/api/admin/subscriptions/update-trial", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          subscriptionId: user.subscription.id,
          trialEndDate: trialEnd.toISOString(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to update trial");
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
      setError(err instanceof Error ? err.message : "Failed to update trial");
    } finally {
      setLoading(false);
    }
  }

  if (!user || !user.subscription) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Edit Trial End Date</DialogTitle>
          <DialogDescription>
            Update the trial end date for {user.name || user.email}'s subscription. This will sync to Stripe automatically.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4 px-6">
          <div className="space-y-2">
            <Label htmlFor="user">User</Label>
            <Input
              id="user"
              value={user.name || user.email}
              disabled
              className="bg-muted"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="plan">Plan</Label>
            <Input
              id="plan"
              value={user.plan?.name || "-"}
              disabled
              className="bg-muted"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Input
              id="status"
              value={user.subscription.status}
              disabled
              className="bg-muted"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="current-trial-end">Current Trial End</Label>
            <Input
              id="current-trial-end"
              value={
                user.subscription.trialEndDate
                  ? format(new Date(user.subscription.trialEndDate), "MMM dd, yyyy HH:mm")
                  : "-"
              }
              disabled
              className="bg-muted"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="trial-end-date">New Trial End Date</Label>
              <Input
                id="trial-end-date"
                type="date"
                value={trialEndDate}
                onChange={(e) => setTrialEndDate(e.target.value)}
                min={format(new Date(), "yyyy-MM-dd")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="trial-end-time">Time</Label>
              <Input
                id="trial-end-time"
                type="time"
                value={trialEndTime}
                onChange={(e) => setTrialEndTime(e.target.value)}
              />
            </div>
          </div>
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
          <Button onClick={handleSave} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

