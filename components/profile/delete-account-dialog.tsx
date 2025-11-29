"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AlertTriangle, Loader2, Eye, EyeOff } from "lucide-react";
import { useToast } from "@/components/toast-provider";

interface DeleteAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DeleteAccountDialog({ open, onOpenChange }: DeleteAccountDialogProps) {
  const [password, setPassword] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const router = useRouter();

  async function handleDelete() {
    if (!password) {
      setError("Password is required");
      return;
    }

    if (!confirmed) {
      setError("Please confirm that you understand this action cannot be undone");
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const response = await fetch("/api/profile/delete-account", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ password }),
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || result.message || "Failed to delete account");
      }
      
      if (result.success) {
        toast({
          title: "Account deleted",
          description: "Your account has been permanently deleted. You will be redirected to the home page.",
          variant: "success",
        });
        
        // Close dialog and redirect to home page
        onOpenChange(false);
        // Wait a moment for the toast to show, then redirect
        setTimeout(() => {
          router.push("/");
        }, 2000);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to delete account";
      setError(errorMessage);
      
      // Check if it's a household ownership error
      if (errorMessage.includes("household") || errorMessage.includes("owner")) {
        toast({
          title: "Cannot delete account",
          description: errorMessage,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error",
          description: errorMessage,
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  }

  function handleClose() {
    if (!loading) {
      setPassword("");
      setConfirmed(false);
      setError(null);
      onOpenChange(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <DialogTitle>Delete Account</DialogTitle>
          </div>
          <DialogDescription>
            This action cannot be undone. Your account will be permanently deleted immediately.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4 px-6">
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 space-y-2">
            <p className="text-sm font-medium text-destructive">
              Warning: This will permanently delete your account
            </p>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
              <li>All your data (transactions, accounts, budgets, goals) will be permanently deleted</li>
              <li>Your active subscription will be cancelled immediately</li>
              <li>This action cannot be undone - there is no recovery period</li>
              <li>You will not be able to access your account after deletion</li>
            </ul>
          </div>

          <div className="space-y-2">
            <Label htmlFor="delete-password">Enter your password to confirm</Label>
            <div className="relative">
              <Input
                id="delete-password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError(null);
                }}
                placeholder="Enter your password"
                size="medium"
                className="pr-10"
                disabled={loading}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 h-8 w-8 text-muted-foreground hover:text-foreground"
                tabIndex={-1}
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </Button>
            </div>
          </div>

          <div className="flex items-start gap-2">
            <Checkbox
              id="confirm-deletion"
              checked={confirmed}
              onCheckedChange={(checked) => {
                setConfirmed(checked === true);
                setError(null);
              }}
              disabled={loading}
            />
            <label
              htmlFor="confirm-deletion"
              className="text-sm leading-relaxed cursor-pointer"
            >
              I understand that this action cannot be undone and all my data will be permanently deleted.
            </label>
          </div>

          {error && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={loading || !password || !confirmed}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Deleting...
              </>
            ) : (
              "Delete Account"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

