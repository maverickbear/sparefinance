"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { accountSchema, AccountFormData } from "@/lib/validations/account";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { useEffect, useState } from "react";
import { useToast } from "@/components/toast-provider";

interface Account {
  id: string;
  name: string;
  type: string;
  creditLimit?: number | null;
  balance?: number;
  createdAt?: string;
  updatedAt?: string;
  ownerIds?: string[];
}

interface Household {
  id: string;
  name: string;
  email: string;
  isOwner: boolean;
}

interface AccountFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account?: Account;
  onSuccess?: () => void;
}

export function AccountForm({ open, onOpenChange, account, onSuccess }: AccountFormProps) {
  const { toast } = useToast();
  const [households, setHouseholds] = useState<Household[]>([]);
  const [selectedOwnerIds, setSelectedOwnerIds] = useState<string[]>([]);
  const [loadingHouseholds, setLoadingHouseholds] = useState(false);

  const form = useForm<AccountFormData>({
    resolver: zodResolver(accountSchema),
    defaultValues: {
      name: "",
      type: "checking",
      creditLimit: undefined,
      ownerIds: [],
    },
  });
  
  const accountType = form.watch("type");

  // Load households when form opens
  useEffect(() => {
    if (open) {
      loadHouseholds();
    }
  }, [open]);

  async function loadHouseholds() {
    try {
      setLoadingHouseholds(true);
      const res = await fetch("/api/households");
      if (res.ok) {
        const data = await res.json();
        // Remove duplicates by id to ensure unique households
        const uniqueHouseholds = Array.from(
          new Map(data.map((h: Household) => [h.id, h])).values()
        );
        setHouseholds(uniqueHouseholds);
      }
    } catch (error) {
      console.error("Error loading households:", error);
    } finally {
      setLoadingHouseholds(false);
    }
  }

  useEffect(() => {
    if (open && households.length > 0) {
      if (account) {
        const ownerIds = account.ownerIds || (account as any).userId ? [(account as any).userId] : [];
        setSelectedOwnerIds(ownerIds);
        form.reset({
          name: account.name,
          type: account.type as "cash" | "checking" | "savings" | "credit" | "investment" | "other",
          creditLimit: account.creditLimit ?? undefined,
          ownerIds: ownerIds,
        });
      } else {
        // Default to current user's household (first one, which is usually the owner)
        const defaultOwnerId = households[0].id;
        setSelectedOwnerIds([defaultOwnerId]);
        form.reset({
          name: "",
          type: "checking",
          creditLimit: undefined,
          ownerIds: [defaultOwnerId],
        });
      }
    }
  }, [open, account, form, households]);

  function handleOwnerToggle(ownerId: string, checked: boolean) {
    if (!checked && selectedOwnerIds.length === 1) {
      toast({
        title: "Error",
        description: "At least one owner must be selected",
        variant: "destructive",
      });
      return;
    }

    const newOwnerIds = checked
      ? [...selectedOwnerIds, ownerId]
      : selectedOwnerIds.filter(id => id !== ownerId);
    
    setSelectedOwnerIds(newOwnerIds);
    form.setValue("ownerIds", newOwnerIds);
  }

  async function onSubmit(data: AccountFormData) {
    try {
      // Ensure at least one owner is selected
      if (selectedOwnerIds.length === 0) {
        toast({
          title: "Error",
          description: "Please select at least one account owner",
          variant: "destructive",
        });
        return;
      }

      const url = account ? `/api/accounts/${account.id}` : "/api/accounts";
      const method = account ? "PATCH" : "POST";

      // Prepare data: only include creditLimit if type is credit
      const payload: AccountFormData = {
        name: data.name,
        type: data.type,
        ownerIds: selectedOwnerIds,
        ...(data.type === "credit" && data.creditLimit !== undefined 
          ? { creditLimit: data.creditLimit } 
          : {}),
      };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(errorData.error || "Failed to save account");
      }

      // Close modal and reset form after successful request
      onOpenChange(false);
      form.reset();

      // Reload accounts after successful save
      onSuccess?.();

      toast({
        title: account ? "Account updated" : "Account created",
        description: account ? "Your account has been updated successfully." : "Your account has been created successfully.",
        variant: "success",
      });
    } catch (error) {
      console.error("Error saving account:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save account",
        variant: "destructive",
      });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{account ? "Edit" : "Add"} Account</DialogTitle>
          <DialogDescription>
            {account ? "Update the account details" : "Create a new account"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-medium">Name</label>
            <Input {...form.register("name")} />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Type</label>
            <Select
              value={form.watch("type")}
              onValueChange={(value) => {
                form.setValue("type", value as "checking" | "savings" | "credit" | "cash" | "investment" | "other");
                // Clear credit limit when changing away from credit type
                if (value !== "credit") {
                  form.setValue("creditLimit", undefined);
                }
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="checking">Checking</SelectItem>
                <SelectItem value="savings">Savings</SelectItem>
                <SelectItem value="credit">Credit Card</SelectItem>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="investment">Investment</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {accountType === "credit" && (
            <div className="space-y-1">
              <label className="text-sm font-medium">Credit Limit</label>
              <Input
                type="text"
                inputMode="decimal"
                placeholder="0.00"
                min="0"
                {...form.register("creditLimit", { 
                  valueAsNumber: true,
                  setValueAs: (value) => {
                    if (value === "" || value === null || value === undefined) {
                      return undefined;
                    }
                    const num = Number(value);
                    return isNaN(num) ? undefined : num;
                  }
                })}
              />
              {form.formState.errors.creditLimit && (
                <p className="text-sm text-destructive">{form.formState.errors.creditLimit.message}</p>
              )}
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium">Account Owners</label>
            <p className="text-xs text-muted-foreground">
              Select one or more households that own this account
            </p>
            {loadingHouseholds ? (
              <p className="text-sm text-muted-foreground">Loading households...</p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto border rounded-md p-3">
                {households.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No households available</p>
                ) : (
                  households.map((household) => (
                    <div key={household.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`owner-${household.id}`}
                        checked={selectedOwnerIds.includes(household.id)}
                        onCheckedChange={(checked) => handleOwnerToggle(household.id, checked as boolean)}
                      />
                      <label
                        htmlFor={`owner-${household.id}`}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer flex-1"
                      >
                        {household.name}
                        {household.isOwner && (
                          <span className="ml-2 text-xs text-muted-foreground">(You)</span>
                        )}
                      </label>
                    </div>
                  ))
                )}
              </div>
            )}
            {form.formState.errors.ownerIds && (
              <p className="text-sm text-destructive">{form.formState.errors.ownerIds.message}</p>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">Save</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

