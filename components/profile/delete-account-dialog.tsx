"use client";

import { useState } from "react";
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
import { AlertTriangle, Loader2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/components/toast-provider";
import { supabase } from "@/lib/supabase";

interface DeleteAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const DELETE_CONFIRMATION_TEXT = "DELETE";

export function DeleteAccountDialog({ open, onOpenChange }: DeleteAccountDialogProps) {
  const [confirmationText, setConfirmationText] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  async function handleDelete() {
    if (confirmationText !== DELETE_CONFIRMATION_TEXT) {
      setError(`Please type "${DELETE_CONFIRMATION_TEXT}" to confirm`);
      return;
    }

    if (!confirmed) {
      setError("Please confirm that you understand this action cannot be undone");
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const response = await fetch("/api/v2/profile/delete-account", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || result.message || "Failed to delete account");
      }
      
      if (result.success) {
        toast({
          title: "Account deleted",
          description: "Your account has been deactivated and your personal information has been anonymized. You will be redirected to the home page.",
          variant: "success",
        });
        
        // Close dialog
        onOpenChange(false);
        
        // Ensure Supabase client is signed out on client side
        try {
          await supabase.auth.signOut();
        } catch (signOutError) {
          // Ignore sign out errors since account is already deleted
          console.log("Sign out after deletion (account already deleted)");
        }
        
        // Wait a moment for the toast to show, then force a complete page reload
        // This ensures all caches and contexts are cleared
        setTimeout(() => {
          window.location.href = "/";
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
      setConfirmationText("");
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
            This action cannot be undone. Your account will be permanently deactivated and your personal information will be anonymized immediately.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4 px-6">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Warning: This will permanently delete your account</AlertTitle>
            <AlertDescription>
              <ul className="list-disc list-inside space-y-1 mt-2">
                <li><strong>Personal information will be removed:</strong> Your name, email, phone number, date of birth, and profile photo will be anonymized</li>
                <li><strong>Account access will be revoked:</strong> Your active subscription will be cancelled immediately</li>
                <li><strong>Data retention:</strong> Some records required by law (such as transaction history and subscription records) will be kept for legal and fiscal compliance, but will no longer be linked to your identity</li>
                <li><strong>Email reuse:</strong> Your email address can be used immediately to create a new account, but your previous data will remain anonymized and cannot be recovered</li>
                <li><strong>This action cannot be undone</strong> - there is no recovery period</li>
              </ul>
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <Label htmlFor="delete-confirmation">
              Type <span className="font-mono font-semibold">{DELETE_CONFIRMATION_TEXT}</span> to confirm
            </Label>
            <Input
              id="delete-confirmation"
              type="text"
              value={confirmationText}
              onChange={(e) => {
                setConfirmationText(e.target.value);
                setError(null);
              }}
              size="medium"
              disabled={loading}
              className="font-mono"
            />
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
              I understand that this action cannot be undone. My personal information will be anonymized, my account will be deactivated, and I will not be able to access my account after deletion. Some records required by law may be retained but will no longer be linked to my identity.
            </label>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
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
            disabled={loading || confirmationText !== DELETE_CONFIRMATION_TEXT || !confirmed}
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

