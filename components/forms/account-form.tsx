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
import { supabase } from "@/lib/supabase";
import { LimitWarning } from "@/components/billing/limit-warning";

interface Account {
  id: string;
  name: string;
  type: string;
  creditLimit?: number | null;
  initialBalance?: number | null;
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
  const [userRole, setUserRole] = useState<"admin" | "member" | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [accountLimit, setAccountLimit] = useState<{ current: number; limit: number } | null>(null);

  const form = useForm<AccountFormData>({
    resolver: zodResolver(accountSchema),
    defaultValues: {
      name: "",
      type: "checking",
      creditLimit: undefined,
      initialBalance: undefined,
      ownerIds: [],
    },
  });
  
  const accountType = form.watch("type");

  // Load current user ID, households and user role when form opens
  useEffect(() => {
    if (open) {
      loadCurrentUserId();
      loadHouseholds();
      loadUserRole();
      loadAccountLimit();
    }
  }, [open]);

  async function loadCurrentUserId() {
    try {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error || !user) {
        console.error("Error loading current user:", error);
        return;
      }
      setCurrentUserId(user.id);
    } catch (error) {
      console.error("Error loading current user:", error);
    }
  }

  async function loadUserRole() {
    try {
      const res = await fetch("/api/members/role");
      if (res.ok) {
        const data = await res.json() as { role: "admin" | "member" };
        setUserRole(data.role);
      }
    } catch (error) {
      console.error("Error loading user role:", error);
      // Default to admin if error
      setUserRole("admin");
    }
  }

  async function loadHouseholds() {
    try {
      setLoadingHouseholds(true);
      const res = await fetch("/api/households");
      if (res.ok) {
        const data = await res.json() as Household[];
        // Remove duplicates by id to ensure unique households
        const uniqueHouseholds: Household[] = Array.from(
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

  async function loadAccountLimit() {
    try {
      const response = await fetch("/api/billing/limits");
      if (response.ok) {
        const data = await response.json();
        if (data.accountLimit) {
          setAccountLimit({
            current: data.accountLimit.current,
            limit: data.accountLimit.limit,
          });
        }
      }
    } catch (error) {
      console.error("Error loading account limit:", error);
    }
  }

  useEffect(() => {
    if (open && currentUserId) {
      if (account) {
        // When editing, use existing ownerIds
        const ownerIds = account.ownerIds || (account as any).userId ? [(account as any).userId] : [];
        setSelectedOwnerIds(ownerIds);
        form.reset({
          name: account.name,
          type: account.type as "cash" | "checking" | "savings" | "credit" | "investment" | "other",
          creditLimit: account.creditLimit ?? undefined,
          initialBalance: account.initialBalance ?? undefined,
          ownerIds: ownerIds,
        });
      } else {
        // When creating new account, always include current user ID
        // Don't set selectedOwnerIds here - it will be set automatically in onSubmit
        setSelectedOwnerIds([]);
        form.reset({
          name: "",
          type: "checking",
          creditLimit: undefined,
          initialBalance: undefined,
          ownerIds: [],
        });
      }
    }
  }, [open, account, form, currentUserId]);

  function handleOwnerToggle(ownerId: string, checked: boolean) {
    // Current user ID is always included, so we only manage additional household IDs
    const newOwnerIds = checked
      ? [...selectedOwnerIds, ownerId]
      : selectedOwnerIds.filter(id => id !== ownerId);
    
    setSelectedOwnerIds(newOwnerIds);
    form.setValue("ownerIds", newOwnerIds);
  }

  async function onSubmit(data: AccountFormData) {
    try {
      if (!currentUserId) {
        toast({
          title: "Error",
          description: "Unable to identify current user",
          variant: "destructive",
        });
        return;
      }

      // Check limit before creating (only for new accounts)
      if (!account && accountLimit) {
        if (accountLimit.limit !== -1 && accountLimit.current >= accountLimit.limit) {
          toast({
            title: "Limit Reached",
            description: `You've reached your account limit (${accountLimit.limit}). Upgrade your plan to add more accounts.`,
            variant: "destructive",
          });
          return;
        }
      }

      // Always include current user ID as owner
      // If user has paid plan and selected additional households, include them too
      let finalOwnerIds: string[] = [currentUserId];
      
      // If user has paid plan (member or admin role) and selected additional households, add them
      if ((userRole === "member" || userRole === "admin") && selectedOwnerIds.length > 0) {
        // Add selected household IDs (these are additional to the current user)
        finalOwnerIds = [currentUserId, ...selectedOwnerIds];
      }

      const url = account ? `/api/accounts/${account.id}` : "/api/accounts";
      const method = account ? "PATCH" : "POST";

      // Prepare data: include creditLimit if type is credit, initialBalance if checking/savings
      // Always include ownerIds to ensure they are saved in AccountOwner table
      const payload: AccountFormData = {
        name: data.name,
        type: data.type,
        ownerIds: finalOwnerIds, // Always include ownerIds to save in Supabase
        ...(data.type === "credit" && data.creditLimit !== undefined 
          ? { creditLimit: data.creditLimit } 
          : {}),
        ...((data.type === "checking" || data.type === "savings") && data.initialBalance !== undefined 
          ? { initialBalance: data.initialBalance } 
          : {}),
      };

      console.log("Submitting account form:", {
        account: account?.id,
        payload,
        finalOwnerIds,
        selectedOwnerIds,
        userRole,
      });

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        let errorMessage = "Failed to save account";
        try {
          const errorData = await res.json();
          errorMessage = errorData.error || errorMessage;
        } catch (parseError) {
          // If response is not JSON, try to get text
          try {
            const text = await res.text();
            errorMessage = text || errorMessage;
          } catch (textError) {
            // If all else fails, use status text
            errorMessage = res.statusText || errorMessage;
          }
        }
        throw new Error(errorMessage);
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
      // Reload limit after error
      loadAccountLimit();
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
          {/* Show limit warning for new accounts */}
          {!account && accountLimit && accountLimit.limit !== -1 && (
            <LimitWarning
              current={accountLimit.current}
              limit={accountLimit.limit}
              type="accounts"
            />
          )}
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
                // Clear initial balance when changing away from checking/savings
                if (value !== "checking" && value !== "savings") {
                  form.setValue("initialBalance", undefined);
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

          {(accountType === "checking" || accountType === "savings") && (
            <div className="space-y-1">
              <label className="text-sm font-medium">Initial Balance</label>
              <Input
                type="text"
                inputMode="decimal"
                placeholder="0.00"
                {...form.register("initialBalance", { 
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
              {form.formState.errors.initialBalance && (
                <p className="text-sm text-destructive">{form.formState.errors.initialBalance.message}</p>
              )}
            </div>
          )}

          {(userRole === "member" || userRole === "admin") && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Additional Account Owners</label>
              <p className="text-xs text-muted-foreground">
                You are automatically included as an owner. Select additional households to share this account with.
              </p>
              {loadingHouseholds ? (
                <p className="text-sm text-muted-foreground">Loading households...</p>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto border rounded-md p-3">
                  {households.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No additional households available</p>
                  ) : (
                    households
                      .filter((household) => household.id !== currentUserId) // Filter out current user
                      .map((household) => (
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
          )}

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

