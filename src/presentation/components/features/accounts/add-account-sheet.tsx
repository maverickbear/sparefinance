"use client";

import { useState, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AccountForm } from "@/components/forms/account-form";
import { Wallet, Loader2 } from "lucide-react";
import { useToast } from "@/components/toast-provider";
import { useBreakpoint } from "@/hooks/use-breakpoint";
import { cn } from "@/lib/utils";

interface AddAccountSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  canWrite?: boolean;
}

export function AddAccountSheet({
  open,
  onOpenChange,
  onSuccess,
  canWrite = true,
}: AddAccountSheetProps) {
  const { toast } = useToast();
  const breakpoint = useBreakpoint();
  const isDesktop = breakpoint === "lg" || breakpoint === "xl" || breakpoint === "2xl";
  const [showManualForm, setShowManualForm] = useState(false);

  const handleManualAccountSuccess = () => {
    setShowManualForm(false);
    onOpenChange(false);
    // Dispatch custom event to notify other components (e.g., OnboardingWidget)
    window.dispatchEvent(new CustomEvent("account-created"));
    onSuccess?.();
    toast({
      title: "Account added",
      description: "Your account has been added successfully.",
      variant: "success",
    });
  };

  if (showManualForm) {
    return (
      <AccountForm
        open={open}
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            setShowManualForm(false);
          }
          onOpenChange(isOpen);
        }}
        onSuccess={handleManualAccountSuccess}
      />
    );
  }

  const content = (
    <div className="space-y-3">
      {/* Manual Account Option */}
      <Button
        variant="outline"
        size="medium"
        className="w-full h-auto p-4 flex items-center gap-3"
        onClick={() => setShowManualForm(true)}
        disabled={!canWrite}
      >
        <div className="p-2 rounded-lg bg-muted">
          <Wallet className="h-5 w-5" />
        </div>
        <div className="flex-1 text-left">
          <div className="font-semibold">Add Account Manually</div>
          <div className="text-sm text-muted-foreground">
            Manually add an account
          </div>
        </div>
      </Button>
    </div>
  );

  return (
    <>


      {/* Render main sheet/dialog */}
      {isDesktop ? (
        <Dialog 
          open={open} 
          onOpenChange={onOpenChange}
        >
          <DialogContent 
            className="max-w-md"
          >
            <DialogHeader>
              <DialogTitle>Add Account</DialogTitle>
            </DialogHeader>
            <div className="px-6 py-6 space-y-3">
              {content}
            </div>
          </DialogContent>
        </Dialog>
      ) : (
        <Sheet 
          open={open} 
          onOpenChange={onOpenChange}
        >
          <SheetContent 
            side="bottom" 
            className="max-h-[60vh] flex flex-col p-0"
          >
            {/* Drag Handle */}
            <div className="flex justify-center pt-3 pb-2 relative">
              <div className="w-12 h-1.5 bg-muted-foreground/30 rounded-full" />
            </div>

            <SheetHeader className="text-left pb-4 border-b px-6 flex-shrink-0">
              <SheetTitle>Add Account</SheetTitle>
            </SheetHeader>

            <div className="px-6 py-6 space-y-3 overflow-y-auto flex-1">
              {content}
            </div>
          </SheetContent>
        </Sheet>
      )}
    </>
  );
}

