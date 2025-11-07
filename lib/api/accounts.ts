"use server";

import { createServerClient } from "@/lib/supabase-server";
import { AccountFormData } from "@/lib/validations/account";
import { getCurrentTimestamp, formatTimestamp } from "@/lib/utils/timestamp";
import { getAccountBalance } from "./transactions";
import { guardAccountLimit, throwIfNotAllowed } from "@/lib/api/feature-guard";

export async function getAccounts() {
    const supabase = await createServerClient();

  const { data: accounts, error } = await supabase
    .from("Account")
    .select("*")
    .order("name", { ascending: true });

  if (error || !accounts) {
    return [];
  }

  // Fetch all transactions up to today in one query to avoid N+1 queries
  // Only include transactions with date <= today (exclude future transactions)
  const today = new Date();
  today.setHours(23, 59, 59, 999); // End of today
  
  const { data: transactions } = await supabase
    .from("Transaction")
    .select("accountId, type, amount, transferToId, transferFromId, date")
    .lte("date", today.toISOString());

  // Calculate balances in memory
  const balances = new Map<string, number>();
  
  // Initialize accounts with their initialBalance (or 0 if not set)
  accounts.forEach((account) => {
    const initialBalance = (account as any).initialBalance ?? 0;
    balances.set(account.id, initialBalance);
  });

  // Calculate balances from transactions (only past and today's transactions)
  const todayDate = new Date();
  todayDate.setHours(0, 0, 0, 0);
  
  for (const tx of transactions || []) {
    // Double-check: only process transactions with date <= today
    const txDate = new Date(tx.date);
    txDate.setHours(0, 0, 0, 0);
    if (txDate > todayDate) {
      continue; // Skip future transactions
    }
    
    const currentBalance = balances.get(tx.accountId) || 0;
    
    if (tx.type === "income") {
      balances.set(tx.accountId, currentBalance + tx.amount);
    } else if (tx.type === "expense") {
      balances.set(tx.accountId, currentBalance - tx.amount);
    } else if (tx.type === "transfer") {
      if (tx.transferToId) {
        // Outgoing transfer - reduce balance
        balances.set(tx.accountId, currentBalance - tx.amount);
      } else {
        // Ingoing transfer - increase balance
        balances.set(tx.accountId, currentBalance + tx.amount);
      }
    }
  }

  // Fetch AccountOwner relationships for all accounts
  const { data: accountOwners } = await supabase
    .from("AccountOwner")
    .select("accountId, ownerId");

  // Create a map: accountId -> ownerIds[]
  const accountOwnersMap = new Map<string, string[]>();
  accountOwners?.forEach((ao) => {
    if (!accountOwnersMap.has(ao.accountId)) {
      accountOwnersMap.set(ao.accountId, []);
    }
    accountOwnersMap.get(ao.accountId)!.push(ao.ownerId);
  });

  // Get all unique owner IDs
  const allOwnerIds = new Set<string>();
  accountOwners?.forEach((ao) => {
    allOwnerIds.add(ao.ownerId);
  });

  // Also include userIds from accounts for backward compatibility
  accounts.forEach((acc) => {
    if (acc.userId) {
      allOwnerIds.add(acc.userId);
    }
  });

  // Fetch owner names
  const { data: owners } = await supabase
    .from("User")
    .select("id, name")
    .in("id", Array.from(allOwnerIds));

  // Create a map: ownerId -> ownerName (first name only)
  const ownerNameMap = new Map<string, string>();
  owners?.forEach((owner) => {
    if (owner.id && owner.name) {
      // Extract only the first name
      const firstName = owner.name.split(' ')[0];
      ownerNameMap.set(owner.id, firstName);
    }
  });

  // Combine accounts with their balances and household names
  const accountsWithBalances = accounts.map((account) => {
    const ownerIds = accountOwnersMap.get(account.id) || 
      (account.userId ? [account.userId] : []);
    
    // Get household names for all owners
    const householdNames = ownerIds
      .map(ownerId => ownerNameMap.get(ownerId))
      .filter(Boolean) as string[];
    
    // Join multiple household names with comma
    const householdName = householdNames.length > 0 
      ? householdNames.join(", ") 
      : null;

    return {
      ...account,
      balance: balances.get(account.id) || 0,
      householdName,
      ownerIds, // Include ownerIds in response
    };
  });

  return accountsWithBalances;
}

export async function createAccount(data: AccountFormData) {
    const supabase = await createServerClient();

  // Get current user
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    throw new Error("Unauthorized");
  }

  // Check account limit before creating
  const limitGuard = await guardAccountLimit(user.id);
  await throwIfNotAllowed(limitGuard);

  // Generate UUID for the account
  const id = crypto.randomUUID();
  const now = formatTimestamp(new Date());

  // Determine owner IDs: use provided ownerIds or default to current user
  const ownerIds = data.ownerIds && data.ownerIds.length > 0 
    ? data.ownerIds 
    : [user.id];

  const { data: account, error } = await supabase
    .from("Account")
    .insert({
      id,
      name: data.name,
      type: data.type,
      creditLimit: data.type === "credit" ? data.creditLimit : null,
      initialBalance: (data.type === "checking" || data.type === "savings") ? (data.initialBalance ?? 0) : null,
      userId: user.id, // Keep userId for backward compatibility and RLS
      createdAt: now,
      updatedAt: now,
    })
    .select()
    .single();

  if (error) {
    console.error("Supabase error creating account:", {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
    });
    throw new Error(`Failed to create account: ${error.message || JSON.stringify(error)}`);
  }

  // Create AccountOwner entries for each owner
  if (ownerIds.length > 0) {
    const accountOwners = ownerIds.map(ownerId => ({
      accountId: id,
      ownerId,
      createdAt: now,
      updatedAt: now,
    }));

    console.log("Creating account owners:", {
      accountId: id,
      ownerIds,
      accountOwners,
      currentUserId: user.id,
    });

    const { data: insertedOwners, error: ownersError } = await supabase
      .from("AccountOwner")
      .insert(accountOwners)
      .select();

    if (ownersError) {
      console.error("Supabase error creating account owners:", {
        error: ownersError,
        message: ownersError.message,
        details: ownersError.details,
        hint: ownersError.hint,
        code: ownersError.code,
        ownerIds,
        accountId: id,
      });
      // Fail the account creation if owners can't be created
      throw new Error(`Failed to create account owners: ${ownersError.message || JSON.stringify(ownersError)}`);
    }

    console.log("Account owners created successfully:", insertedOwners);
  }

  return account;
}

export async function updateAccount(id: string, data: Partial<AccountFormData>) {
    const supabase = await createServerClient();

  const updateData: Record<string, unknown> = { ...data };
  
  // Remove ownerIds from updateData as it's handled separately
  const ownerIds = updateData.ownerIds as string[] | undefined;
  delete updateData.ownerIds;
  
  // Handle creditLimit: set to null if not credit type, otherwise use provided value
  if (data.type !== undefined) {
    if (data.type === "credit") {
      updateData.creditLimit = data.creditLimit ?? null;
      updateData.initialBalance = null;
    } else {
      updateData.creditLimit = null;
    }
  } else if (data.creditLimit !== undefined) {
    // If only creditLimit is being updated, keep it as is
    updateData.creditLimit = data.creditLimit;
  }
  
  // Handle initialBalance: set to null if not checking/savings type, otherwise use provided value
  if (data.type !== undefined) {
    if (data.type === "checking" || data.type === "savings") {
      updateData.initialBalance = data.initialBalance ?? 0;
    } else {
      updateData.initialBalance = null;
    }
  } else if (data.initialBalance !== undefined) {
    // If only initialBalance is being updated, keep it as is
    updateData.initialBalance = data.initialBalance;
  }
  
  updateData.updatedAt = formatTimestamp(new Date());

  const { data: account, error } = await supabase
    .from("Account")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Supabase error updating account:", error);
    throw new Error(`Failed to update account: ${error.message || JSON.stringify(error)}`);
  }

  // Update AccountOwner entries if ownerIds are provided
  if (ownerIds !== undefined) {
    // Ensure at least one owner is provided
    if (ownerIds.length === 0) {
      throw new Error("At least one account owner is required");
    }

    const now = formatTimestamp(new Date());
    
    // Delete existing owners
    const { error: deleteError } = await supabase
      .from("AccountOwner")
      .delete()
      .eq("accountId", id);

    if (deleteError) {
      console.error("Supabase error deleting account owners:", deleteError);
      throw new Error(`Failed to update account owners: ${deleteError.message || JSON.stringify(deleteError)}`);
    }

    // Insert new owners
    const accountOwners = ownerIds.map(ownerId => ({
      accountId: id,
      ownerId,
      createdAt: now,
      updatedAt: now,
    }));

    const { error: ownersError } = await supabase
      .from("AccountOwner")
      .insert(accountOwners);

    if (ownersError) {
      console.error("Supabase error updating account owners:", ownersError);
      throw new Error(`Failed to update account owners: ${ownersError.message || JSON.stringify(ownersError)}`);
    }
  }

  return account;
}

export async function deleteAccount(id: string) {
    const supabase = await createServerClient();

  const { error } = await supabase.from("Account").delete().eq("id", id);

  if (error) {
    console.error("Supabase error deleting account:", error);
    throw new Error(`Failed to delete account: ${error.message || JSON.stringify(error)}`);
  }
}
