"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AccountForm } from "@/components/forms/account-form";
import { Wallet } from "lucide-react";
import { useToast } from "@/components/toast-provider";

interface AddAccountDropdownProps {
  onSuccess?: () => void;
  canWrite?: boolean;
  trigger?: React.ReactNode;
}

export function AddAccountDropdown({
  onSuccess,
  canWrite = true,
  trigger,
}: AddAccountDropdownProps) {
  const { toast } = useToast();
  const [showManualForm, setShowManualForm] = useState(false);

  const handleManualAccountSuccess = () => {
    setShowManualForm(false);
    window.dispatchEvent(new CustomEvent("account-created"));
    onSuccess?.();
    toast({
      title: "Account added",
      description: "Your account has been added successfully.",
      variant: "success",
    });
  };

  const defaultTrigger = (
    <Button size="medium" disabled={!canWrite}>
      Add Account
      <Wallet className="h-4 w-4 ml-1.5" />
    </Button>
  );

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          {trigger || defaultTrigger}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem
            onClick={() => setShowManualForm(true)}
            disabled={!canWrite}
          >
            <Wallet className="h-4 w-4 mr-2" />
            Add Manually
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Manual Account Form */}
      {showManualForm && (
        <AccountForm
          open={showManualForm}
          onOpenChange={(isOpen) => {
            if (!isOpen) {
              setShowManualForm(false);
            }
          }}
          onSuccess={handleManualAccountSuccess}
        />
      )}
    </>
  );
}

