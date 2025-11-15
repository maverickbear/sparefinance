"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
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
import { Loader2 } from "lucide-react";
import { DollarAmountInput } from "@/components/common/dollar-amount-input";

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
  initialAccountLimit?: { current: number; limit: number } | null;
}

export function AccountForm({ open, onOpenChange, account, onSuccess, initialAccountLimit }: AccountFormProps) {
  const { toast } = useToast();
  const [households, setHouseholds] = useState<Household[]>([]);
  const [selectedOwnerIds, setSelectedOwnerIds] = useState<string[]>([]);
  const [loadingHouseholds, setLoadingHouseholds] = useState(false);
  const [userRole, setUserRole] = useState<"admin" | "member" | "super_admin" | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [accountLimit, setAccountLimit] = useState<{ current: number; limit: number } | null>(null);
  const [loadingLimit, setLoadingLimit] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  // Use initialAccountLimit if available, otherwise use accountLimit state
  const currentAccountLimit = initialAccountLimit !== undefined ? initialAccountLimit : accountLimit;
  
  // Check if limit is reached
  const isLimitReached = currentAccountLimit && currentAccountLimit.limit !== -1 && currentAccountLimit.current >= currentAccountLimit.limit;

  // Load current user ID, households and user role when form opens
  useEffect(() => {
    if (open) {
      loadCurrentUserId();
      loadHouseholds();
      loadUserRole();
      // Use initial limit if provided, otherwise load it
      if (initialAccountLimit !== undefined) {
        setAccountLimit(initialAccountLimit);
      } else {
        // Load limit immediately when modal opens
        loadAccountLimit();
      }
    } else {
      // Reset limit when modal closes
      setAccountLimit(null);
    }
  }, [open, initialAccountLimit]);

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
      const { getUserRoleClient } = await import("@/lib/api/members-client");
      const role = await getUserRoleClient();
      if (role) {
        setUserRole(role);
      } else {
        // Default to admin if no role found (user is owner)
        setUserRole("admin");
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
      const { getHouseholdMembersClient } = await import("@/lib/api/members-client");
      const members = await getHouseholdMembersClient();
      
      // Transform household members into households format
      const householdsList: Household[] = members
        .filter(member => member.status === "active" && member.memberId) // Only include active members with memberId
        .map(member => ({
          id: member.memberId!, // memberId is guaranteed to exist due to filter
          name: member.name || member.email,
          email: member.email,
          isOwner: member.isOwner || false,
        }));
      
      // Remove duplicates by id to ensure unique households
      const uniqueHouseholds: Household[] = Array.from(
        new Map(householdsList.map((h: Household) => [h.id, h])).values()
      );
      setHouseholds(uniqueHouseholds);
    } catch (error) {
      console.error("Error loading households:", error);
    } finally {
      setLoadingHouseholds(false);
    }
  }

  async function loadAccountLimit() {
    try {
      setLoadingLimit(true);
      const { getBillingLimitsAction } = await import("@/lib/actions/billing");
      const limits = await getBillingLimitsAction();
      if (limits?.accountLimit) {
        setAccountLimit({
          current: limits.accountLimit.current,
          limit: limits.accountLimit.limit,
        });
      }
    } catch (error) {
      console.error("Error loading account limit:", error);
    } finally {
      setLoadingLimit(false);
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
      setIsSubmitting(true);
      if (!currentUserId) {
        toast({
          title: "Error",
          description: "Unable to identify current user",
          variant: "destructive",
        });
        setIsSubmitting(false);
        return;
      }

      // Check limit before creating (only for new accounts)
      if (!account && currentAccountLimit) {
        if (currentAccountLimit.limit !== -1 && currentAccountLimit.current >= currentAccountLimit.limit) {
          toast({
            title: "Limit Reached",
            description: `You've reached your account limit (${currentAccountLimit.limit}). Upgrade your plan to add more accounts.`,
            variant: "destructive",
          });
          setIsSubmitting(false);
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
        ...((data.type === "checking" || data.type === "savings")
          ? { 
              initialBalance: account 
                ? (data.initialBalance !== undefined ? data.initialBalance : account.initialBalance ?? 0)
                : (data.initialBalance ?? 0)
            } 
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
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-h-[90vh] flex flex-col !p-0 !gap-0">
        <DialogHeader>
          <DialogTitle>{account ? "Edit" : "Add"} Account</DialogTitle>
          <DialogDescription>
            {account ? "Update the account details" : "Create a new account"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
          {/* Show limit warning for new accounts - show immediately if limit reached */}
          {!account && currentAccountLimit && currentAccountLimit.limit !== -1 && (
            <LimitWarning
              current={currentAccountLimit.current}
              limit={currentAccountLimit.limit}
              type="accounts"
            />
          )}
          
          {/* Show loading state only if limit is not yet loaded and not provided */}
          {!account && !currentAccountLimit && loadingLimit && (
            <div className="text-sm text-muted-foreground">Checking limit...</div>
          )}
          
          {/* Hide form fields if limit is reached for new accounts */}
          {(!account && isLimitReached) ? null : (
            <>
              <div className="space-y-1">
                <label className="text-sm font-medium">Name</label>
                <Input {...form.register("name")} required />
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
                  required
                >
                  <SelectTrigger required>
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
                  <DollarAmountInput
                    value={form.watch("creditLimit") || undefined}
                    onChange={(value) => form.setValue("creditLimit", value ?? undefined, { shouldValidate: true })}
                    placeholder="$ 0.00"
                    required
                  />
                  {form.formState.errors.creditLimit && (
                    <p className="text-sm text-destructive">{form.formState.errors.creditLimit.message}</p>
                  )}
                </div>
              )}

              {(accountType === "checking" || accountType === "savings") && (
                <div className="space-y-1">
                  <label className="text-sm font-medium">Initial Balance</label>
                  <DollarAmountInput
                    value={form.watch("initialBalance") ?? undefined}
                    onChange={(value) => form.setValue("initialBalance", value !== undefined ? value : undefined, { shouldValidate: true })}
                    placeholder="$ 0.00"
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
                      {households.filter((household) => household.id !== currentUserId).length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          You haven't invited any member yet.{" "}
                          <Link href="/members" className="text-primary hover:underline font-medium">
                            Invite
                          </Link>{" "}
                          now
                        </p>
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
            </>
          )}

          </div>

          <DialogFooter className="justify-between">
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
                Cancel
              </Button>
              {(!account && isLimitReached) ? null : (
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save"
                  )}
                </Button>
              )}
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

