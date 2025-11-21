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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, CheckCircle } from "lucide-react";
import type { AdminUser } from "@/lib/api/admin";

interface UnblockUserDialogProps {
  user: AdminUser | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function UnblockUserDialog({
  user,
  open,
  onOpenChange,
  onSuccess,
}: UnblockUserDialogProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  async function handleUnblock() {
    if (!user) return;

    if (!reason.trim()) {
      setError("Please provide a reason for unblocking this user");
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const response = await fetch("/api/admin/users/unblock", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: user.id,
          reason: reason.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to unblock user");
        setLoading(false);
        return;
      }

      onSuccess();
      onOpenChange(false);
      setReason("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to unblock user");
    } finally {
      setLoading(false);
    }
  }

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            Unblock User
          </DialogTitle>
          <DialogDescription>
            Unblock {user.name || user.email} to restore access to the system
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
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
            <Label htmlFor="reason">Reason for unblocking *</Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Enter the reason for unblocking this user..."
              rows={4}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              This reason will be saved in the block history.
            </p>
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
            onClick={() => {
              onOpenChange(false);
              setReason("");
              setError(null);
            }}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleUnblock}
            disabled={loading || !reason.trim()}
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Unblock User
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

