"use server";

import { revalidateTag } from "next/cache";
import { createServerClient } from "@/lib/supabase-server";
import { AccountFormData } from "@/lib/validations/account";
import { getCurrentTimestamp, formatTimestamp } from "@/lib/utils/timestamp";
import { getAccountBalance } from "./transactions";
import { guardAccountLimit, throwIfNotAllowed } from "@/lib/api/feature-guard";
import { requireAccountOwnership } from "@/lib/utils/security";
import { decryptAmount } from "@/lib/utils/transaction-encryption";

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
  // Use a consistent date comparison to avoid timezone issues
  const now = new Date();
  const todayYear = now.getFullYear();
  const todayMonth = now.getMonth();
  const todayDay = now.getDate();
  
  // Create date for end of today in local timezone, then convert to ISO for query
  const todayEnd = new Date(todayYear, todayMonth, todayDay, 23, 59, 59, 999);
  
  const { data: transactions } = await supabase
    .from("Transaction")
    .select("accountId, type, amount, date")
    .lte("date", todayEnd.toISOString());

  // Calculate balances in memory
  const balances = new Map<string, number>();
  
  // Initialize accounts with their initialBalance (or 0 if not set)
  accounts.forEach((account) => {
    const initialBalance = (account as any).initialBalance ?? 0;
    balances.set(account.id, initialBalance);
  });

  // Calculate balances from transactions (only past and today's transactions)
  // Compare dates by year, month, day only to avoid timezone issues
  const todayDate = new Date(todayYear, todayMonth, todayDay);
  
  for (const tx of transactions || []) {
    // Parse transaction date and compare only date part (ignore time)
    const txDateObj = new Date(tx.date);
    const txYear = txDateObj.getFullYear();
    const txMonth = txDateObj.getMonth();
    const txDay = txDateObj.getDate();
    const txDate = new Date(txYear, txMonth, txDay);
    
    // Skip future transactions (date > today)
    if (txDate > todayDate) {
      continue;
    }
    
    const currentBalance = balances.get(tx.accountId) || 0;
    
    // Decrypt amount if encrypted
    const decryptedAmount = decryptAmount(tx.amount);
    
    // Skip transaction if amount is invalid (null, NaN, or unreasonably large)
    if (decryptedAmount === null || isNaN(decryptedAmount) || !isFinite(decryptedAmount)) {
      logger.warn('Skipping transaction with invalid amount:', {
        accountId: tx.accountId,
        amount: tx.amount,
        decryptedAmount,
      });
      continue;
    }
    
    if (tx.type === "income") {
      balances.set(tx.accountId, currentBalance + decryptedAmount);
    } else if (tx.type === "expense") {
      balances.set(tx.accountId, currentBalance - Math.abs(decryptedAmount));
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

    // Don't select the inserted data to reduce overhead
    const { error: ownersError } = await supabase
      .from("AccountOwner")
      .insert(accountOwners);

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
  }

  // Invalidate cache to ensure dashboard shows updated data
  revalidateTag('accounts', 'max');
  revalidateTag('dashboard', 'max');

  return account;
}

export async function updateAccount(id: string, data: Partial<AccountFormData>) {
    const supabase = await createServerClient();

  // Verify ownership before updating
  await requireAccountOwnership(id);

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

  // Invalidate cache to ensure dashboard shows updated data
  revalidateTag('accounts', 'max');
  revalidateTag('dashboard', 'max');

  return account;
}

/**
 * Transfer all transactions from one account to another
 */
export async function transferAccountTransactions(
  fromAccountId: string,
  toAccountId: string
): Promise<{ transferred: number }> {
  const supabase = await createServerClient();

  // Verify ownership of both accounts
  await requireAccountOwnership(fromAccountId);
  await requireAccountOwnership(toAccountId);

  // Get all transactions for the source account
  const { data: transactions, error: fetchError } = await supabase
    .from("Transaction")
    .select("id")
    .eq("accountId", fromAccountId);

  if (fetchError) {
    console.error("Supabase error fetching transactions:", fetchError);
    throw new Error(`Failed to fetch transactions: ${fetchError.message || JSON.stringify(fetchError)}`);
  }

  if (!transactions || transactions.length === 0) {
    return { transferred: 0 };
  }

  // Update all transactions to the new account
  const { error: updateError } = await supabase
    .from("Transaction")
    .update({ accountId: toAccountId })
    .eq("accountId", fromAccountId);

  if (updateError) {
    console.error("Supabase error transferring transactions:", updateError);
    throw new Error(`Failed to transfer transactions: ${updateError.message || JSON.stringify(updateError)}`);
  }

  // Also handle transfer transactions that might reference this account
  // Update transactions where toAccountId references the account being deleted
  const { error: transferUpdateError } = await supabase
    .from("Transaction")
    .update({ toAccountId: toAccountId })
    .eq("toAccountId", fromAccountId);

  if (transferUpdateError) {
    console.error("Supabase error updating transfer transactions:", transferUpdateError);
    // Don't throw - this is not critical, just log it
  }

  // Invalidate cache
  revalidateTag('transactions', 'max');
  revalidateTag('accounts', 'max');
  revalidateTag('dashboard', 'max');

  return { transferred: transactions.length };
}

/**
 * Check if an account has associated transactions
 */
export async function accountHasTransactions(accountId: string): Promise<boolean> {
  const supabase = await createServerClient();

  // Verify ownership
  await requireAccountOwnership(accountId);

  const { data, error } = await supabase
    .from("Transaction")
    .select("id")
    .eq("accountId", accountId)
    .limit(1);

  if (error) {
    console.error("Supabase error checking transactions:", error);
    // If we can't check, assume there are transactions to be safe
    return true;
  }

  return (data?.length ?? 0) > 0;
}

export async function deleteAccount(id: string, transferToAccountId?: string) {
    const supabase = await createServerClient();

  // Verify ownership before deleting
  await requireAccountOwnership(id);

  // If a transfer account is provided, transfer transactions first
  if (transferToAccountId) {
    await transferAccountTransactions(id, transferToAccountId);
  } else {
    // Check if account has transactions
    const hasTransactions = await accountHasTransactions(id);
    if (hasTransactions) {
      throw new Error("Account has associated transactions. Please select a destination account to transfer them to.");
    }
  }

  const { error } = await supabase.from("Account").delete().eq("id", id);

  if (error) {
    console.error("Supabase error deleting account:", error);
    throw new Error(`Failed to delete account: ${error.message || JSON.stringify(error)}`);
  }

  // Invalidate cache to ensure dashboard shows updated data
  revalidateTag('accounts', 'max');
  revalidateTag('dashboard', 'max');
  revalidateTag('transactions', 'max');
}
