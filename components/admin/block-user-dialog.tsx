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
import { Loader2, Ban } from "lucide-react";
import type { AdminUser } from "@/lib/api/admin";

interface BlockUserDialogProps {
  user: AdminUser | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function BlockUserDialog({
  user,
  open,
  onOpenChange,
  onSuccess,
}: BlockUserDialogProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  async function handleBlock() {
    if (!user) return;

    if (!reason.trim()) {
      setError("Please provide a reason for blocking this user");
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const response = await fetch("/api/admin/users/block", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: user.id,
          isBlocked: true,
          reason: reason.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to block user");
        setLoading(false);
        return;
      }

      onSuccess();
      onOpenChange(false);
      setReason("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to block user");
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
            <Ban className="h-5 w-5 text-destructive" />
            Block User
          </DialogTitle>
          <DialogDescription>
            Block {user.name || user.email} from accessing the system
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
            <Label htmlFor="reason">Reason for blocking *</Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Enter the reason for blocking this user..."
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
            variant="destructive"
            onClick={handleBlock}
            disabled={loading || !reason.trim()}
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Block User
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

